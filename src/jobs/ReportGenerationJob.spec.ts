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
      findByTasksSpy.mockResolvedValueOnce([]);

      const job = new ReportGenerationJob(taskRepository);

      await expect(job.run(reportingTask)).rejects.toThrow('No previously tasks to report');
    });
  });

  describe('When there are at least one more queued tasks in the workflow', () => {
    it('Should not run the job', async () => {
      const reportingTask = getQueuedTask({});
      const queuedTask = getQueuedTask({});
      findByTasksSpy.mockResolvedValueOnce([queuedTask]);

      const job = new ReportGenerationJob(taskRepository);
      const result = await job.run(reportingTask);

      expect(result).toEqual({ taskShouldWait: true });
    });
  });

  describe('When the rest of the task in the workflow are completed', () => {
    it('Should log the task Id at job starting', async () => {
      const reportingTask = getQueuedTask({});
      const completedTask = getCompletedTask({});
      findByTasksSpy.mockResolvedValueOnce([completedTask]);

      const job = new ReportGenerationJob(taskRepository);
      await job.run(reportingTask);

      expect(logSpy).toHaveBeenCalledWith(
        `Running reporting for all completed task belonging to ${reportingTask.workflow.workflowId} workflow...`
      );
    });

    it('Should run the job and return the report', async () => {
      const reportingTask = getQueuedTask({});
      const completedTaskOne = getCompletedTask({ id: '1', type: 'polygonArea', output: '1' });
      const completedTaskTwo = getCompletedTask({
        id: '2',
        type: 'dataAnalysis',
        output: 'Brazil',
      });
      findByTasksSpy.mockResolvedValueOnce([completedTaskOne, completedTaskTwo]);

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
});
