import { prisma } from '../lib/prisma.js';
import type { CustomFieldType, CustomFieldVisibility } from '@prisma/client';

export async function listDefinitions(organizationId: string) {
  return prisma.taskCustomFieldDefinition.findMany({
    where: { organizationId },
    orderBy: { label: 'asc' },
    include: { _count: { select: { boardFields: true, values: true } } },
  });
}

export async function createDefinition(organizationId: string, data: {
  fieldKey: string;
  label: string;
  fieldType?: CustomFieldType;
  uiVisibility?: CustomFieldVisibility;
  validationRegex?: string;
  defaultValue?: string;
}) {
  return prisma.taskCustomFieldDefinition.create({
    data: { organizationId, ...data },
    include: { _count: { select: { boardFields: true, values: true } } },
  });
}

export async function updateDefinition(id: string, organizationId: string, data: {
  label?: string;
  fieldType?: CustomFieldType;
  uiVisibility?: CustomFieldVisibility;
  validationRegex?: string | null;
  defaultValue?: string | null;
}) {
  return prisma.taskCustomFieldDefinition.update({
    where: { id, organizationId },
    data,
    include: { _count: { select: { boardFields: true, values: true } } },
  });
}

export async function deleteDefinition(id: string, organizationId: string) {
  return prisma.taskCustomFieldDefinition.delete({ where: { id, organizationId } });
}

export async function attachToBoard(definitionId: string, organizationId: string, boardIds: string[]) {
  // Verify definition belongs to org
  const def = await prisma.taskCustomFieldDefinition.findFirst({ where: { id: definitionId, organizationId } });
  if (!def) throw new Error('Custom field definition not found');

  // Verify boards belong to org
  const boards = await prisma.board.findMany({ where: { id: { in: boardIds }, organizationId } });
  if (boards.length !== boardIds.length) throw new Error('Some boards not found');

  // Upsert attachments
  const results = await Promise.all(
    boardIds.map(boardId =>
      prisma.boardTaskCustomField.upsert({
        where: { boardId_definitionId: { boardId, definitionId } },
        create: { boardId, definitionId },
        update: {},
      })
    )
  );
  return results;
}

export async function getBoardFields(boardId: string) {
  return prisma.boardTaskCustomField.findMany({
    where: { boardId },
    include: { definition: true },
  });
}

export async function setFieldValue(taskId: string, definitionId: string, value: string) {
  return prisma.taskCustomFieldValue.upsert({
    where: { taskId_definitionId: { taskId, definitionId } },
    create: { taskId, definitionId, value },
    update: { value },
  });
}

export async function getTaskFieldValues(taskId: string) {
  return prisma.taskCustomFieldValue.findMany({
    where: { taskId },
    include: { definition: true },
  });
}
