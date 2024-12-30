import { Not, Repository } from 'typeorm';
import { Job } from './Job';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

type Report = {
  workflowId: string;
  tasks: MappedTaskForReporting[];
  finalReport: string;
};

type MappedTaskForReporting = {
  taskId: string;
  type: string;
  output?: string;
  isFailed?: boolean;
};

export class ReportGenerationJob implements Job {
  constructor(private taskRepository: Repository<Task>) {}

  async run(task: Task): Promise<Report | Record<'taskShouldWait', boolean> | Error> {
    const workflowId = task.workflow.workflowId;
    const workflowTasks = await this.getTasksByWorkflowId(workflowId);
    const tasks = this.getTasksWithoutReportingOne(workflowTasks, task);

    if (tasks.length === 0) throw new Error('No previously tasks to report');

    const allTasksExecuted = tasks.every(this.isExecuted);
    if (!allTasksExecuted) return { taskShouldWait: true };

    console.log(
      `Running reporting for all executed task belonging to ${task.workflow.workflowId} workflow...`
    );

    const mappedTasks = tasks.map(this.mapTaskForReporting.bind(this));
    const finalReport = `Report for workflow ${workflowId}: ${JSON.stringify(mappedTasks)}`;
    return { workflowId, tasks: mappedTasks, finalReport };
  }

  private getTasksWithoutReportingOne(workflowTasks: Task[], reportingTask: Task) {
    return workflowTasks.filter(t => t.taskId !== reportingTask.taskId);
  }

  private mapTaskForReporting(task: Task) {
    const mappedTask: MappedTaskForReporting = { taskId: task.taskId, type: task.taskType };
    if (this.isCompleted(task)) mappedTask.output = task.output;
    if (this.isFailed(task)) mappedTask.isFailed = true;
    return mappedTask;
  }

  private async getTasksByWorkflowId(workflowId: string) {
    return await this.taskRepository.findBy({
      workflow: { workflowId },
    });
  }

  private isExecuted(task: Task): boolean {
    return task.status !== TaskStatus.Queued;
  }

  private isCompleted(task: Task): boolean {
    return task.status === TaskStatus.Completed;
  }

  private isFailed(task: Task): boolean {
    return task.status === TaskStatus.Failed;
  }
}
