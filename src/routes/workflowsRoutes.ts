import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

const router = Router();
const workflowRepository = AppDataSource.getRepository(Workflow);

router.get('/:id/status', async (req, res) => {
  const { id: workflowId } = req.params;

  try {
    const workflow = await workflowRepository.findOne({
      where: { workflowId: workflowId },
      relations: ['tasks'],
    });

    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
    } else {
      const completedTasks = workflow.tasks.filter(
        task => task.status === TaskStatus.Completed
      ).length;
      const totalTasks = workflow.tasks.length;
      res.status(200).json({
        workflowId,
        status: workflow.status,
        completedTasks,
        totalTasks,
      });
    }
  } catch (error: any) {
    console.error('Error getting workflow status:', error);
    res.status(500).json({ message: 'Error getting workflow status' });
  }
});

export default router;
