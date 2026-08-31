import { prisma } from '../lib/prisma.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function listTags(organizationId: string) {
  return prisma.tag.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { assignments: true } } },
  });
}

export async function createTag(organizationId: string, data: {
  name: string;
  color?: string;
  description?: string;
}) {
  return prisma.tag.create({
    data: {
      organizationId,
      name: data.name,
      slug: slugify(data.name),
      color: data.color ?? '#6366f1',
      description: data.description,
    },
    include: { _count: { select: { assignments: true } } },
  });
}

export async function updateTag(id: string, organizationId: string, data: {
  name?: string;
  color?: string;
  description?: string;
}) {
  return prisma.tag.update({
    where: { id, organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name, slug: slugify(data.name) }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.description !== undefined && { description: data.description }),
    },
    include: { _count: { select: { assignments: true } } },
  });
}

export async function deleteTag(id: string, organizationId: string) {
  return prisma.tag.delete({ where: { id, organizationId } });
}

export async function assignTags(taskId: string, organizationId: string, tagIds: string[]) {
  // Verify task belongs to org
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) throw new Error('Task not found');

  // Verify all tags belong to org
  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds }, organizationId } });
  if (tags.length !== tagIds.length) throw new Error('Some tags not found');

  // Replace all assignments
  await prisma.$transaction([
    prisma.tagAssignment.deleteMany({ where: { taskId } }),
    ...tagIds.map(tagId =>
      prisma.tagAssignment.create({ data: { taskId, tagId } })
    ),
  ]);

  return prisma.tagAssignment.findMany({
    where: { taskId },
    include: { tag: true },
  });
}

export async function getTaskTags(taskId: string) {
  return prisma.tagAssignment.findMany({
    where: { taskId },
    include: { tag: true },
  });
}
