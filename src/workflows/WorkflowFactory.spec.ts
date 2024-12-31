import * as fs from 'fs';
import { AppDataSource } from '../data-source';
import { WorkflowFactory } from './WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

const getTask = ({
  step,
  type = 'area',
  geoJson,
  clientId,
  workflow,
  dependency,
}: {
  step: number;
  type?: string;
  geoJson: string;
  clientId: string;
  workflow: Workflow;
  dependency?: Task;
}) => {
  const task = new Task();
  task.stepNumber = step;
  task.taskType = type;
  task.geoJson = geoJson;
  task.clientId = clientId;
  task.workflow = workflow;
  task.status = TaskStatus.Queued;
  if (dependency) task.dependency = dependency;
  return task;
};

const workflowYmlContent = `
  name: 'dependant_tasks_workflow'
  steps:
    - taskType: 'area'
      stepNumber: 1
    - taskType: 'analysis'
      stepNumber: 2
      dependsOnStep: 1`;

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => workflowYmlContent),
}));

describe('When creates a workflow with dependant tasks', () => {
  const clientId = 'client-id';
  const geoJson = 'geoJsonData';
  let saveWorkflowSpy: jest.SpyInstance;
  let saveTaskSpy: jest.SpyInstance;
  const workflowRepository = AppDataSource.getRepository(Workflow);
  const taskRepository = AppDataSource.getRepository(Task);

  beforeEach(() => {
    saveWorkflowSpy = jest.spyOn(workflowRepository, 'save');
    saveTaskSpy = jest.spyOn(taskRepository, 'save');
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  it('Should add a dependency field to the task with dependant', async () => {
    const workflow = new Workflow();
    workflow.clientId = clientId;
    saveWorkflowSpy.mockResolvedValue(workflow);

    const taskStep1 = getTask({ step: 1, workflow, type: 'area', geoJson, clientId });
    const taskStep2 = getTask({
      step: 2,
      workflow,
      type: 'analysis',
      geoJson,
      clientId,
      dependency: taskStep1,
    });
    saveTaskSpy.mockResolvedValue([taskStep1, taskStep2]);

    const workflowFactory = new WorkflowFactory(AppDataSource);
    await workflowFactory.createWorkflowFromYAML('path/to/workflow.yml', clientId, geoJson);

    expect(saveTaskSpy).toHaveBeenCalledWith([taskStep1, taskStep2]);
  });
});
