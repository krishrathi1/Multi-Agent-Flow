import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useAgentStore } from '../../stores/agent-store';
import type { Priority } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';

interface Props {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority: string;
    agentId?: string;
  }) => void;
}

export function AddTaskModal({ onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [agentId, setAgentId] = useState('');
  const [error, setError] = useState<string>();
  const agents = useAgentStore((s) => s.agents);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the task a title so agents know what to pick up.');
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      agentId: agentId || undefined,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={ListPlus}
      title="New Task"
      description="Add work to the board and optionally assign an agent."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-task-form">
            Create Task
          </Button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          autoFocus
          value={title}
          error={error}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(undefined);
          }}
          placeholder="e.g. Investigate elevated error rate"
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context, links, or acceptance criteria…"
          hint="Optional — but agents work better with detail."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>

          <Select
            label="Assign to"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
