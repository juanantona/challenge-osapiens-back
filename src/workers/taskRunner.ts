import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';

export enum TaskStatus {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

type TaskForWorkFlowResult = {
  taskId: string;
  type: string;
  output?: string;
  isFailed?: boolean;
  isPending?: boolean;
};

export class TaskRunner {
  constructor(private taskRepository: Repository<Task>) {}

  /**
   * Runs the appropriate job based on the task's type, managing the task's status.
   * @param task - The task entity that determines which job to run.
   * @throws If the job fails, it rethrows the error.
   */
  async run(task: Task): Promise<void> {
    const dependantTask = await this.getDependantTask(task);
    if (dependantTask) {
      if (this.isCompleted(dependantTask)) task.input = dependantTask.output;
      else if (this.isFailed(dependantTask)) throw new Error('Dependant task failed');
      else return;
    }

    task.status = TaskStatus.InProgress;
    task.progress = 'starting job...';
    await this.taskRepository.save(task);
    const job = getJobForTaskType(task.taskType);

    try {
      console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
      const resultRepository = this.taskRepository.manager.getRepository(Result);
      const taskResult = await job.run(task);
      if (taskResult?.taskShouldWait) {
        task.status = TaskStatus.Queued;
        task.progress = 'waiting...';
        await this.taskRepository.save(task);
        return;
      }
      console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
      const result = new Result();
      result.taskId = task.taskId!;
      result.data = JSON.stringify(taskResult || {});
      await resultRepository.save(result);
      task.resultId = result.resultId!;
      task.status = TaskStatus.Completed;
      task.progress = null;
      task.output = result.data;
      await this.taskRepository.save(task);
    } catch (error: any) {
      console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

      task.status = TaskStatus.Failed;
      task.progress = null;
      await this.taskRepository.save(task);

      throw error;
    }

    const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
    const currentWorkflow = await workflowRepository.findOne({
      where: { workflowId: task.workflow.workflowId },
      relations: ['tasks'],
    });

    if (currentWorkflow) {
      const allCompleted = currentWorkflow.tasks.every(this.isCompleted.bind(this));
      const anyFailed = currentWorkflow.tasks.some(this.isFailed.bind(this));

      currentWorkflow.status = WorkflowStatus.InProgress;
      if (anyFailed) currentWorkflow.status = WorkflowStatus.Failed;
      if (allCompleted) currentWorkflow.status = WorkflowStatus.Completed;

      const isFinished = anyFailed || allCompleted;
      if (isFinished) currentWorkflow.finalResult = this.getFinalResult(currentWorkflow.tasks);
      await workflowRepository.save(currentWorkflow);
    }
  }

  private async getDependantTask(task: Task): Promise<Task | null> {
    if (!task.dependency) return null;
    const dependantTask = await this.taskRepository.findOne({
      where: { taskId: task.dependency.taskId },
      relations: ['workflow'],
    });
    return dependantTask;
  }

  private isCompleted(task: Task): boolean {
    return task.status === TaskStatus.Completed;
  }

  private isFailed(task: Task): boolean {
    return task.status === TaskStatus.Failed;
  }

  private isPending(task: Task): boolean {
    return task.status === TaskStatus.InProgress || task.status === TaskStatus.Queued;
  }

  private getFinalResult(tasks: Task[]): string {
    const mappedTasks = tasks.map(this.mapTaskForFinalResult.bind(this));
    return `Resume of the workflow execution: ${JSON.stringify(mappedTasks)}`;
  }

  private mapTaskForFinalResult(task: Task) {
    const mappedTask: TaskForWorkFlowResult = { taskId: task.taskId, type: task.taskType };
    if (this.isCompleted(task)) mappedTask.output = task.output;
    if (this.isFailed(task)) mappedTask.isFailed = true;
    if (this.isPending(task)) mappedTask.isPending = true;
    return mappedTask;
  }
}
