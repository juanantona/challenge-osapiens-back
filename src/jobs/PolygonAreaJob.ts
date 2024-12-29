import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Feature, Polygon } from 'geojson';

export class PolygonAreaJob implements Job {
  async run(task: Task): Promise<number> {
    console.log(`Running calculating area for task ${task.taskId}...`);

    try {
      const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);
      const inputGeometryArea = area(inputGeometry);
      console.log(`The polygon area is ${inputGeometryArea} square meters.`);

      return inputGeometryArea;
    } catch (error) {
      throw error;
    }
  }
}
