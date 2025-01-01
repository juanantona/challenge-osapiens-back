import { Router } from 'express';
import { AppDataSource } from '../../data-source';
import { Workflow } from '../../models/Workflow';
import { WorkflowService } from '../../domain/WorkflowService';

const router = Router();
const workflowRepository = AppDataSource.getRepository(Workflow);

router.get('/:id/status', async (req, res) => {
  const { id: workflowId } = req.params;

  try {
    const workflow = await WorkflowService.create(workflowId, workflowRepository);

    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
    } else {
      res.status(200).json({
        workflowId,
        status: workflow.status,
        completedTasks: workflow.getCompletedTasks().length,
        totalTasks: workflow.tasks.length,
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
    const workflow = await WorkflowService.create(workflowId, workflowRepository);

    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
    } else {
      const allCompleted = workflow.areAllTaskCompleted();
      const anyFailed = workflow.isAnyTaskFailed();
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
