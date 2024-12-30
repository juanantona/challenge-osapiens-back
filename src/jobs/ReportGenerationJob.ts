import { Not, Repository } from 'typeorm';
import { Job } from './Job';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

type Report = {
  workflowId: string;
  tasks: MappedTask[];
  finalReport: string;
};

type MappedTask = {
  taskId: string;
  type: string;
  output?: string;
  isFailed?: boolean;
};

export class ReportGenerationJob implements Job {
  constructor(private taskRepository: Repository<Task>) {}

  async run(task: Task): Promise<Report | Record<'taskShouldWait', boolean> | Error> {
    const workflowId = task.workflow.workflowId;
    const tasks = await this.taskRepository.findBy({
      taskId: Not(task.taskId),
      workflow: { workflowId },
    });

    if (tasks.length === 0) throw new Error('No previously tasks to report');

    const allCompleted = tasks.every(t => t.status === TaskStatus.Completed);
    const anyFailed = tasks.some(t => t.status === TaskStatus.Failed);

    if (!allCompleted && !anyFailed) return { taskShouldWait: true };

    console.log(
      `Running reporting for all completed task belonging to ${task.workflow.workflowId} workflow...`
    );

    const mappedTasks = tasks.map(t => {
      const mappedTask: MappedTask = { taskId: t.taskId, type: t.taskType };
      if (t.status === TaskStatus.Completed) mappedTask.output = t.output;
      if (t.status === TaskStatus.Failed) mappedTask.isFailed = true;
      return mappedTask;
    });

    const finalReport = `Report for workflow ${workflowId}: ${JSON.stringify(mappedTasks)}`;
    return { workflowId, tasks: mappedTasks, finalReport };
  }
}
