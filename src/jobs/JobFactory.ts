import { AppDataSource } from '../data-source';
import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';
import { Task } from '../models/Task';

const jobMap: Record<string, () => Job> = {
  analysis: () => new DataAnalysisJob(),
  notification: () => new EmailNotificationJob(),
  area: () => new PolygonAreaJob(),
  report: () => {
    const taskRepository = AppDataSource.getRepository(Task);
    return new ReportGenerationJob(taskRepository);
  },
};

export function getJobForTaskType(taskType: string): Job {
  const jobFactory = jobMap[taskType];
  if (!jobFactory) {
    throw new Error(`No job found for task type: ${taskType}`);
  }
  return jobFactory();
}
