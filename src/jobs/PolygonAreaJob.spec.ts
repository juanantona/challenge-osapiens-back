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
  area: 4631853809.79,
};

describe('PolygonAreaJob', () => {
  describe('When running a task with a valid geoJson', () => {
    it('Should return the correct area', async () => {
      const task = new Task();
      task.geoJson = JSON.stringify(geoJson);

      const job = new PolygonAreaJob();
      const result = await job.run(task);

      expect(result).toBe(geoJson.area);
    });
  });
});
