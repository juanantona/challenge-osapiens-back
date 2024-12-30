import { AppDataSource } from '../data-source';
import { ReportGenerationJob } from './ReportGenerationJob';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

describe('ReportGenerationJob', () => {
  let logSpy: jest.SpyInstance;
  const taskRepository = AppDataSource.getRepository(Task);
  const findByTasksSpy = jest.spyOn(taskRepository, 'findBy');

  beforeEach(() => {
    logSpy = jest.spyOn(global.console, 'log');
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  describe('When the current task is the only task in the workflow', () => {
    it('Should throw an error', async () => {
      const workflow = new Workflow();
      const currentTask = new Task();
      currentTask.taskId = 'task-id';
      currentTask.workflow = workflow;
      currentTask.status = TaskStatus.Queued;
      findByTasksSpy.mockResolvedValueOnce([]);

      const job = new ReportGenerationJob(taskRepository);

      await expect(job.run(currentTask)).rejects.toThrow('No previously tasks to report');
    });
  });

  describe('When there are at least one more queued or failed tasks in the workflow', () => {
    it('Should not run the job', async () => {
      const workflow = new Workflow();
      const currentTask = new Task();
      currentTask.workflow = workflow;
      currentTask.status = TaskStatus.Queued;
      const task = new Task();
      task.workflow = workflow;
      task.status = TaskStatus.Queued;
      findByTasksSpy.mockResolvedValueOnce([task]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(currentTask);

      expect(result).toEqual({ taskShouldWait: true });
    });
  });

  describe('When the rest of the task in the workflow are completed', () => {
    it('Should run the job and log the task Id at job starting', async () => {
      const workflow = new Workflow();
      workflow.workflowId = 'workflow-id';
      const currentTask = new Task();
      currentTask.workflow = workflow;
      currentTask.status = TaskStatus.Queued;
      const task = new Task();
      task.workflow = workflow;
      task.status = TaskStatus.Completed;
      findByTasksSpy.mockResolvedValueOnce([task]);

      const job = new ReportGenerationJob(taskRepository);
      await job.run(currentTask);

      expect(logSpy).toHaveBeenCalledWith(
        `Running reporting for all completed task belonging to ${currentTask.workflow.workflowId} workflow...`
      );
    });
  });
});
