import { PolygonAreaJob } from './PolygonAreaJob';
import { Task } from '../models/Task';

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
  areaInSquareMeters: 4621506484.056065,
};

describe('PolygonAreaJob', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(global.console, 'log');
  });

  afterEach(() => {
    jest.restoreAllMocks;
  });

  describe('When the job runs', () => {
    it('Should log the task Id at job starting', async () => {
      const task = new Task();
      task.taskId = 'task-id';
      task.geoJson = JSON.stringify(geoJson);

      const job = new PolygonAreaJob();
      await job.run(task);

      expect(logSpy).toHaveBeenCalledWith(`Running calculating area for task ${task.taskId}...`);
    });
  });

  describe('When the job runs a task with an non valid polygon', () => {
    it('Should throw an error', async () => {
      const task = new Task();
      task.taskId = 'task-id';
      task.geoJson = '{}';

      const job = new PolygonAreaJob();

      await expect(job.run(task)).rejects.toThrow();
    });
  });

  describe('When the job runs a task with a valid geoJson', () => {
    it('Should log area calculation message with taskId', async () => {
      const task = new Task();
      task.taskId = 'task-id';
      task.geoJson = JSON.stringify(geoJson);

      const job = new PolygonAreaJob();
      await job.run(task);

      expect(logSpy).toHaveBeenCalledWith(
        `The polygon area is ${geoJson.areaInSquareMeters} square meters.`
      );
    });

    it('Should return the correct area', async () => {
      const task = new Task();
      task.geoJson = JSON.stringify(geoJson);

      const job = new PolygonAreaJob();
      const result = await job.run(task);

      expect(result).toBe(geoJson.areaInSquareMeters);
    });
  });
});
