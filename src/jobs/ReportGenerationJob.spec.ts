import { AppDataSource } from '../data-source';
import { ReportGenerationJob } from './ReportGenerationJob';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

const getTask = ({
  id = '1',
  status,
  type = 'polygonArea',
  output,
}: {
  status: TaskStatus;
  id?: string;
  type?: string;
  output?: string;
}) => {
  const task = new Task();
  const workflow = new Workflow();
  workflow.workflowId = 'workflow-id';
  task.taskId = `task-id-${id}`;
  task.workflow = workflow;
  task.status = status;
  task.taskType = type;
  task.output = output;
  return task;
};

const getQueuedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Queued, type, output });

const getCompletedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Completed, type, output });

const getFailedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Failed, type, output });

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
      const reportingTask = getQueuedTask({});
      findByTasksSpy.mockResolvedValueOnce([reportingTask]);

      const job = new ReportGenerationJob(taskRepository);

      await expect(job.run(reportingTask)).rejects.toThrow('No previously tasks to report');
    });
  });

  describe('When there are at least one more queued tasks in the workflow', () => {
    it('Should not run the job', async () => {
      const reportingTask = getQueuedTask({ id: '1' });
      const queuedTask = getQueuedTask({ id: '2' });
      findByTasksSpy.mockResolvedValueOnce([reportingTask, queuedTask]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(reportingTask);

      expect(result).toEqual({ taskShouldWait: true });
    });
  });

  describe('When the rest of the task in the workflow are completed', () => {
    it('Should log the task Id at job starting', async () => {
      const reportingTask = getQueuedTask({ id: '1' });
      const completedTask = getCompletedTask({ id: '2' });
      findByTasksSpy.mockResolvedValueOnce([reportingTask, completedTask]);

      const job = new ReportGenerationJob(taskRepository);
      await job.run(reportingTask);

      expect(logSpy).toHaveBeenCalledWith(
        `Running reporting for all executed task belonging to ${reportingTask.workflow.workflowId} workflow...`
      );
    });

    it('Should run the job and return the report', async () => {
      const reportingTask = getQueuedTask({ id: '1' });
      const completedTaskOne = getCompletedTask({ id: '2', type: 'polygonArea', output: '1' });
      const completedTaskTwo = getCompletedTask({
        id: '3',
        type: 'dataAnalysis',
        output: 'Brazil',
      });
      findByTasksSpy.mockResolvedValueOnce([reportingTask, completedTaskOne, completedTaskTwo]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(reportingTask);

      const mappedTasks = [
        {
          taskId: completedTaskOne.taskId,
          type: completedTaskOne.taskType,
          output: completedTaskOne.output,
        },
        {
          taskId: completedTaskTwo.taskId,
          type: completedTaskTwo.taskType,
          output: completedTaskTwo.output,
        },
      ];

      expect(result).toEqual({
        workflowId: reportingTask.workflow.workflowId,
        tasks: mappedTasks,
        finalReport: `Report for workflow ${reportingTask.workflow.workflowId}: ${JSON.stringify(
          mappedTasks
        )}`,
      });
    });
  });

  describe('When there are at least one failed tasks in the workflow', () => {
    it('Should include error information in the report', async () => {
      const reportingTask = getQueuedTask({ id: '1' });
      const completedTask = getCompletedTask({ id: '2' });
      const failedTask = getFailedTask({ id: '3' });
      findByTasksSpy.mockResolvedValueOnce([reportingTask, completedTask, failedTask]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(reportingTask);

      const mappedTasks = [
        {
          taskId: completedTask.taskId,
          type: completedTask.taskType,
          output: completedTask.output,
        },
        {
          taskId: failedTask.taskId,
          type: failedTask.taskType,
          isFailed: true,
        },
      ];

      expect(result).toEqual({
        workflowId: reportingTask.workflow.workflowId,
        tasks: mappedTasks,
        finalReport: `Report for workflow ${reportingTask.workflow.workflowId}: ${JSON.stringify(
          mappedTasks
        )}`,
      });
    });
  });
});
