import { AppDataSource } from '../data-source';
import { ReportGenerationJob } from './ReportGenerationJob';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

const getTask = ({
  id = 'task-id',
  status = TaskStatus.Queued,
}: {
  id?: string;
  status?: TaskStatus;
}) => {
  const task = new Task();
  const workflow = new Workflow();
  workflow.workflowId = 'workflow-id';
  task.taskId = id;
  task.workflow = workflow;
  task.status = status;
  return task;
};

describe('ReportGenerationJob', () => {
  let logSpy: jest.SpyInstance;
  let findByTasksSpy: jest.SpyInstance;
  const taskRepository = AppDataSource.getRepository(Task);

  beforeEach(() => {
    logSpy = jest.spyOn(global.console, 'log');
    findByTasksSpy = jest.spyOn(taskRepository, 'findBy');
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  describe('When the current task is the only task in the workflow', () => {
    it('Should throw an error', async () => {
      const reportingTask = getTask({});
      findByTasksSpy.mockResolvedValueOnce([]);

      const job = new ReportGenerationJob(taskRepository);

      await expect(job.run(reportingTask)).rejects.toThrow('No previously tasks to report');
    });
  });

  describe('When there are at least one more queued or failed tasks in the workflow', () => {
    it('Should not run the job', async () => {
      const reportingTask = getTask({});
      const queuedTask = getTask({ status: TaskStatus.Queued });
      findByTasksSpy.mockResolvedValueOnce([queuedTask]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(reportingTask);

      expect(result).toEqual({ taskShouldWait: true });
    });
  });

  describe('When the rest of the task in the workflow are completed', () => {
    it('Should log the task Id at job starting', async () => {
      const reportingTask = getTask({});
      const completedTask = getTask({ status: TaskStatus.Completed });
      findByTasksSpy.mockResolvedValueOnce([completedTask]);

      const job = new ReportGenerationJob(taskRepository);
      await job.run(reportingTask);

      expect(logSpy).toHaveBeenCalledWith(
        `Running reporting for all completed task belonging to ${reportingTask.workflow.workflowId} workflow...`
      );
    });
  });
});
