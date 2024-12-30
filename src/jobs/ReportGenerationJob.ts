import { Not, Repository } from 'typeorm';
import { Job } from './Job';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

type Report = {
  workflowId: string;
  tasks: {
    taskId: string;
    type: string;
    output?: string;
  }[];
  finalReport: string;
};

export class ReportGenerationJob implements Job {
  constructor(private taskRepository: Repository<Task>) {}

  async run(task: Task): Promise<Report | Record<'taskShouldWait', boolean> | undefined | Error> {
    const workflowId = task.workflow.workflowId;
    const tasks = await this.taskRepository.findBy({
      taskId: Not(task.taskId),
      workflow: { workflowId },
    });

    if (tasks.length === 0) throw new Error('No previously tasks to report');

    const allCompleted = tasks.every(t => t.status === TaskStatus.Completed);
    if (!allCompleted) return { taskShouldWait: true };

    console.log(
      `Running reporting for all completed task belonging to ${task.workflow.workflowId} workflow...`
    );

    return;
  }
}
