import { AppDataSource } from '../data-source';
import { TaskRunner } from './taskRunner';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { Result } from '../models/Result';

type MockedTask = {
  id?: string;
  status: TaskStatus;
  type?: string;
  output?: string;
};

const getTask = ({ id = '1', status, type = 'notification', output }: MockedTask) => {
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

const getQueuedTask = ({ id, type, output }: Omit<MockedTask, 'status'>) =>
  getTask({ id, status: TaskStatus.Queued, type, output });

const getCompletedTask = ({ id, type, output }: Omit<MockedTask, 'status'>) =>
  getTask({ id, status: TaskStatus.Completed, type, output });

const getFailedTask = ({ id, type, output }: Omit<MockedTask, 'status'>) =>
  getTask({ id, status: TaskStatus.Failed, type, output });

describe('taskRunner', () => {
  let findOneTasksSpy: jest.SpyInstance;
  let managerTasksSpy: jest.SpyInstance;
  const taskRepository = AppDataSource.getRepository(Task);
  const resultRepository = AppDataSource.getRepository(Result);
  const workflowRepository = AppDataSource.getRepository(Workflow);

  beforeEach(() => {
    findOneTasksSpy = jest.spyOn(taskRepository, 'findOne');
    managerTasksSpy = jest
      .spyOn(taskRepository.manager, 'getRepository')
      .mockImplementationOnce(() => resultRepository)
      .mockImplementationOnce(() => workflowRepository);
    taskRepository.save = jest.fn();
    resultRepository.save = jest.fn();
    workflowRepository.save = jest.fn();
    workflowRepository.findOne = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  describe('When the current task depends on a queued task', () => {
    it('Should not start to run the task', async () => {
      const currentTask = getQueuedTask({ id: '1' });
      const queuedDependantTask = getQueuedTask({ id: '2' });
      currentTask.dependency = queuedDependantTask;
      findOneTasksSpy.mockResolvedValueOnce(queuedDependantTask);

      const taskRunner = new TaskRunner(taskRepository);
      await taskRunner.run(currentTask);

      expect(taskRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('When the current task depends on a queued or failed task', () => {
    it('Should not start to run the task', async () => {
      const currentTask = getQueuedTask({ id: '1' });
      const failedDependantTask = getFailedTask({ id: '2' });
      currentTask.dependency = failedDependantTask;
      findOneTasksSpy.mockResolvedValueOnce(failedDependantTask);

      const taskRunner = new TaskRunner(taskRepository);
      await taskRunner.run(currentTask);

      expect(taskRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('When the current task depends on a completed task', () => {
    it('Should save the dependant task output in the current task input', async () => {
      const currentTask = getQueuedTask({ id: '1' });
      const completedDependantTask = getCompletedTask({ id: '2', output: 'completed-output' });
      currentTask.dependency = completedDependantTask;
      findOneTasksSpy.mockResolvedValueOnce(completedDependantTask);

      const taskRunner = new TaskRunner(taskRepository);
      await taskRunner.run(currentTask);

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'completed-output' })
      );
    });
  });
});
