import { AppDataSource } from '../data-source';
import { TaskRunner } from './taskRunner';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { Result } from '../models/Result';

const geoJson = {
  type: 'Polygon',
  coordinates: [
    [
      [-46.159527846351466, -16.048997734633218],
      [-46.76235118226248, -16.048997734633218],
      [-46.76235118226248, -16.695249531930827],
      [-46.159527846351466, -16.695249531930827],
      [-46.159527846351466, -16.048997734633218],
    ],
  ],
};

const getTask = ({
  id = '1',
  status,
  type = 'analysis',
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
  task.geoJson = JSON.stringify(geoJson);
  return task;
};

const getQueuedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Queued, type, output });

const getCompletedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Completed, type, output });

const getFailedTask = ({ id, type, output }: { id?: string; type?: string; output?: string }) =>
  getTask({ id, status: TaskStatus.Failed, type, output });

describe('taskRunner', () => {
  let saveTasksSpy: jest.SpyInstance;
  let findOneTasksSpy: jest.SpyInstance;
  let managerTasksSpy: jest.SpyInstance;
  const taskRepository = AppDataSource.getRepository(Task);
  const resultRepository = AppDataSource.getRepository(Result);
  const workflowRepository = AppDataSource.getRepository(Workflow);

  beforeEach(() => {
    saveTasksSpy = jest.spyOn(taskRepository, 'save');
    findOneTasksSpy = jest.spyOn(taskRepository, 'findOne');
    managerTasksSpy = jest
      .spyOn(taskRepository.manager, 'getRepository')
      .mockImplementationOnce(() => resultRepository)
      .mockImplementationOnce(() => workflowRepository);
    resultRepository.save = jest.fn();
    workflowRepository.save = jest.fn();
    workflowRepository.findOne = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  describe('When the current task depends on a queued or failed task', () => {
    it('Should not start to run the task', async () => {
      const currentTask = getQueuedTask({ id: '1' });
      const queuedDependantTask = getQueuedTask({ id: '2' });
      currentTask.dependency = queuedDependantTask;
      findOneTasksSpy.mockResolvedValueOnce(queuedDependantTask);

      const taskRunner = new TaskRunner(taskRepository);
      await taskRunner.run(currentTask);

      expect(saveTasksSpy).not.toHaveBeenCalled();
    });
  });

  describe('When the current task depends on a completed task', () => {
    it('Should save the dependant task output in the current task input', async () => {
      const currentTask = getQueuedTask({ id: '1' });
      const completedDependantTask = getCompletedTask({ id: '2', output: 'completed-output' });
      currentTask.dependency = completedDependantTask;
      findOneTasksSpy.mockResolvedValueOnce(completedDependantTask);
      saveTasksSpy.mockResolvedValueOnce(currentTask).mockResolvedValue({});

      const taskRunner = new TaskRunner(taskRepository);
      await taskRunner.run(currentTask);

      expect(saveTasksSpy).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'completed-output' })
      );
    });
  });
});
