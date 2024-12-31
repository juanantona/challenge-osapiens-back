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

router.get('/:id/results', async (req, res) => {
  const { id: workflowId } = req.params;

  try {
    const workflow = await workflowRepository.findOne({
      where: { workflowId: workflowId },
      relations: ['tasks'],
    });

    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
    } else {
      const allCompleted = workflow.tasks.every(task => task.status === TaskStatus.Completed);
      const anyFailed = workflow.tasks.some(task => task.status === TaskStatus.Failed);
      const { status, finalResult } = workflow;
      if (allCompleted || anyFailed) res.status(200).json({ workflowId, status, finalResult });
      else res.status(400).json({ message: 'Workflow is not yet completed' });
    }
  } catch (error: any) {
    console.error('Error getting workflow results:', error);
    res.status(500).json({ message: 'Error getting workflow results' });
  }
});

export default router;
