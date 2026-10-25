import { prisma } from '../lib/prisma.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function listTemplates(organizationId: string, category?: string) {
  return prisma.soulTemplate.findMany({
    where: { organizationId, ...(category && { category }) },
    orderBy: { name: 'asc' },
  });
}

export async function getTemplate(id: string, organizationId: string) {
  return prisma.soulTemplate.findFirst({ where: { id, organizationId } });
}

export async function createTemplate(organizationId: string, data: {
  name: string;
  category?: string;
  description?: string;
  content: string;
}) {
  return prisma.soulTemplate.create({
    data: {
      organizationId,
      name: data.name,
      slug: slugify(data.name),
      category: data.category ?? 'general',
      description: data.description ?? '',
      content: data.content,
    },
  });
}

export async function updateTemplate(id: string, organizationId: string, data: {
  name?: string;
  category?: string;
  description?: string;
  content?: string;
}) {
  return prisma.soulTemplate.update({
    where: { id, organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name, slug: slugify(data.name) }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.content !== undefined && { content: data.content }),
    },
  });
}

export async function deleteTemplate(id: string, organizationId: string) {
  return prisma.soulTemplate.delete({ where: { id, organizationId } });
}

export async function searchTemplates(organizationId: string, query: string) {
  return prisma.soulTemplate.findMany({
    where: {
      organizationId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
  });
}
