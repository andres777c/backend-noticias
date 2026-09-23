import { z } from 'zod';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number()
    .int('La página debe ser un número entero')
    .positive('La página debe ser mayor a 0')
    .default(1)
    .optional(),
  limit: z.coerce.number()
    .int('El límite debe ser un número entero')
    .min(1, 'El límite debe ser al menos 1')
    .max(50, 'El límite máximo es 50')
    .default(10)
    .optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// El slug no se acepta del cliente: el servicio lo genera siempre a partir del
// título (ver NewsService.createNews y editNews). Si viene en el cuerpo, Zod lo descarta.
export const createNewsSchema = z.object({
  title: z.string().min(3, 'Título demasiado corto'),
  summary: z.string().min(10, 'Resumen demasiado corto'),
  content: z.string().min(20, 'Contenido demasiado corto'),
  highlights: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return [val]; }
    }
    return val;
  }, z.array(z.string().min(1)).default([])),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de categoría inválido'),
  mainImage: z.string().optional(),
  source: z.string().optional(),
  variant: z.enum(['highlighted', 'featured', 'default']).default('default'),
});

export const updateNewsSchema = createNewsSchema.partial().extend({
  status: z
    .enum(['draft', 'in_review', 'approved', 'published', 'rejected'])
    .optional(),
  // Se acepta como texto y se convierte: en una petición HTTP toda fecha viaja
  // como cadena, así que exigir un objeto Date hacía imposible editar una noticia
  // que ya tuviera fecha de publicación.
  publicationDate: z.coerce.date().nullable().optional(),
});

export const newsIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido'),
});

export const newsQuerySchema = z.object({
  status: z
    .enum(['draft', 'in_review', 'approved', 'published', 'rejected'])
    .optional(),
  author: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de autor inválido').optional(),
});

export const newsByCategoryQuerySchema = z.object({
  category: z.string().min(1, 'Categoría de noticia inválida'),
});

export const searchNewsQuerySchema = z.object({
  q: z.string()
    .min(1, 'Término de búsqueda requerido')
    .max(100, 'Término de búsqueda demasiado largo'),
  page: z.coerce.number()
    .int('La página debe ser un número entero')
    .positive('La página debe ser mayor a 0')
    .default(1)
    .optional(),
  limit: z.coerce.number()
    .int('El límite debe ser un número entero')
    .min(1, 'El límite debe ser al menos 1')
    .max(50, 'El límite máximo es 50')
    .default(10)
    .optional(),
});

// ============================================
// TIPOS INFERIDOS (para usar como DTOs temporales)
// ============================================
export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;
export type NewsQuery = z.infer<typeof newsQuerySchema>;
export type NewsIdParam = z.infer<typeof newsIdParamSchema>;
export type NewsByCategoryQuery = z.infer<typeof newsByCategoryQuerySchema>;
export type SearchNewsQuery = z.infer<typeof searchNewsQuerySchema>;
