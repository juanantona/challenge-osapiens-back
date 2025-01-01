import { Repository } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

export class WorkflowService {
  private readonly workflow: Workflow;

  private constructor(
    private readonly id: string,
    private readonly workflowRepository: Repository<Workflow>,
    workflow: Workflow
  ) {
    this.workflow = workflow;
  }

  static async create(
    id: string,
    workflowRepository: Repository<Workflow>
  ): Promise<WorkflowService | null> {
    const workflow = await workflowRepository.findOne({
      where: { workflowId: id },
      relations: ['tasks'],
    });

    if (!workflow) return null;
    return new WorkflowService(id, workflowRepository, workflow);
  }

  get tasks() {
    return this.workflow.tasks;
  }

  get status() {
    return this.workflow.status;
  }

  get finalResult() {
    return this.workflow.finalResult;
  }

  getCompletedTasks() {
    return this.workflow.tasks.filter(this.isCompleted.bind(this));
  }

  isCompleted(task: Task): boolean {
    return task.status === TaskStatus.Completed;
  }

  isFailed(task: Task): boolean {
    return task.status === TaskStatus.Failed;
  }

  areAllTaskCompleted(): boolean {
    return this.workflow.tasks.every(this.isCompleted.bind(this));
  }

  isAnyTaskFailed(): boolean {
    return this.workflow.tasks.some(this.isFailed.bind(this));
  }
}
