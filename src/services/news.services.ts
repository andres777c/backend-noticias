import { Types } from 'mongoose';

import type {
  CreateNewsRequestDto,
  UpdateNewsRequestDto,
  NewsQueryRequestDto
} from '../dtos/news.dto.js';
import { AppError } from '../errors/AppError.js';
import { cleanUndefined } from '../helpers/cleanUndefined.js';
import { normalizeSpaces } from '../helpers/normalizeSpaces.js';
import type { INews } from '../interfaces/news.interface.js';
import type { IPaginationOptions, IPaginatedResponse } from '../interfaces/pagination.interface.js';
import { NewsRepository } from '../repositories/news.repository.js';

/**
 * Servicio para la gestión de noticias.
 * Contiene la lógica de negocio y orquesta las operaciones con el repositorio.
 *
 * @example
 * ```typescript
 * const newsService = new NewsService();
 * const news = await newsService.createNews(data, authorId);
 * ```
 */
export class NewsService {
  private newsRepository: NewsRepository;

  /**
   * Crea una instancia del servicio de noticias.
   *
   * @param newsRepository - Repositorio opcional para inyección de dependencias
   */
  constructor(newsRepository?: NewsRepository) {
    this.newsRepository = newsRepository || new NewsRepository();
  }

  /**
   * Obtiene todas las noticias aplicando filtros opcionales.
   *
   * @param filters - Filtros opcionales para la consulta
   * @param filters.status - Filtrar por estado de la noticia
   * @param filters.author - Filtrar por ID del autor
   * @returns Array de noticias que cumplen los filtros
   */
  async getAllNews(filters?: NewsQueryRequestDto): Promise<INews[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.author) {
      try {
        query.author = new Types.ObjectId(filters.author);
      } catch {
        return [];
      }
    }

    return this.newsRepository.findAll(query);
  }

  /**
   * Obtiene todas las noticias con paginación y filtros opcionales.
   * Para usuarios sin rol admin, solo devuelve noticias publicadas.
   */
  async getNewsPaginated(
    filters?: NewsQueryRequestDto,
    options?: IPaginationOptions,
    userRole?: string
  ): Promise<IPaginatedResponse<INews>> {
    const query: any = {};

    // Si el usuario no es admin/superadmin/editor, forzar status=published
    const isAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'editor';
    if (!isAdmin) {
      query.status = 'published';
    } else if (filters?.status) {
      // Si es admin y especifica status en el filtro, respetarlo
      query.status = filters.status;
    }

    if (filters?.author) {
      try {
        query.author = new Types.ObjectId(filters.author);
      } catch {
        return { results: [], total: 0, page: 1, totalPages: 0 };
      }
    }

    return this.newsRepository.findAllPaginated(query, options);
  }

  /**
   * Crea una nueva noticia en estado borrador.
   *
   * @param newsData - Datos validados de la noticia
   * @param authorId - ID del usuario autor autenticado
   * @returns Noticia creada con ID asignado
   */
  async createNews(
    newsData: CreateNewsRequestDto,
    authorId: Types.ObjectId
  ): Promise<INews> {
    const slug = newsData.title.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "-");

    const newsToCreate = cleanUndefined({
      ...newsData,
      content: normalizeSpaces(newsData.content),
      slug,
      author: authorId,
      status: 'draft' as const,
      publicationDate: null
    }) as Partial<INews>;

    return this.newsRepository.create(newsToCreate);
  }

  /**
   * Obtiene una noticia específica por su ID.
   *
   * @param id - ID de la noticia a buscar
   * @returns Noticia encontrada o null si no existe
   */
  async getNewsById(id: string): Promise<INews | null> {
    return this.newsRepository.findById(id);
  }

  /**
   * Obtiene todas las noticias de una categoría específica.
   *
   * @param category - ID de la categoría
   * @returns Array de noticias de la categoría
   */
  async getNewsByCategory(category: string): Promise<INews[]> {
    return this.newsRepository.findByCategory(category);
  }

  /**
   * Obtiene las ultimas noticias publicadas por categorias.
   *
   * @param categories - IDs de categoria
   * @param limit - Cantidad maxima de noticias
   * @returns Array de noticias publicadas ordenadas por fecha
   */
  async getLatestPublishedByCategories(
    categories: string[],
    limit: number = 10
  ): Promise<INews[]> {
    if (!Array.isArray(categories) || categories.length === 0) {
      return [];
    }

    const normalizedLimit = Math.min(50, Math.max(1, limit));
    const categoryIds = categories
      .map((cat) => {
        try {
          return new Types.ObjectId(cat);
        } catch {
          return null;
        }
      })
      .filter((cat): cat is Types.ObjectId => Boolean(cat));

    if (categoryIds.length === 0) {
      return [];
    }

    return this.newsRepository.findPublishedByCategories(
      categoryIds,
      normalizedLimit
    );
  }

  async editNews(
    id: string,
    newsData: UpdateNewsRequestDto,
    userId?: string,
    userRole?: string
  ): Promise<INews> {
    const existingNews = await this.newsRepository.findById(id);

    if (!existingNews) {
      throw new AppError('Noticia no encontrada', 404, 'NEWS_NOT_FOUND');
    }

    const author = existingNews.author;
    const authorId = typeof author === 'object' && '_id' in author
      ? String(author._id)
      : String(author);

    if (userId && authorId !== userId) {
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        throw new AppError('No tiene permisos para editar esta noticia', 403, 'NOT_AUTHOR');
      }
    }

    const cleanedData = cleanUndefined(newsData) as Partial<INews>;

    if (cleanedData.content) {
      cleanedData.content = normalizeSpaces(cleanedData.content);
    }

    // Generar slug nuevamente si el título cambia
    if (cleanedData.title) {
        cleanedData.slug = cleanedData.title.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }

    if (cleanedData.status === 'published' && !cleanedData.publicationDate) {
      cleanedData.publicationDate = new Date();
    }

    const updated = await this.newsRepository.update(id, cleanedData);
    if (!updated) {
      throw new AppError('Error al actualizar la noticia', 500, 'NEWS_UPDATE_ERROR');
    }

    return updated;
  }

  async deleteNews(
    id: string,
    userId?: string,
    userRole?: string
  ): Promise<INews> {
    const existingNews = await this.newsRepository.findById(id);

    if (!existingNews) {
      throw new AppError('Noticia no encontrada', 404, 'NEWS_NOT_FOUND');
    }

    const author = existingNews.author;
    const authorId = typeof author === 'object' && '_id' in author
      ? String(author._id)
      : String(author);

    if (userId && authorId !== userId) {
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        throw new AppError('No tiene permisos para eliminar esta noticia', 403, 'NOT_AUTHOR');
      }
    }

    const deleted = await this.newsRepository.delete(id);
    if (!deleted) {
      throw new AppError('Error al eliminar la noticia', 500, 'NEWS_DELETE_ERROR');
    }

    return deleted;
  }

  /**
  * Busca noticias que contengan una palabra clave específica.
  *
  * Utiliza búsqueda parcial con regex y patrón tolerante a acentos.
  * Retorna resultados ordenados por fecha de publicación descendente.
  * Soporta paginación para manejar grandes volúmenes de datos.
   *
   * @param q - Palabra clave o término de búsqueda
   * @param page - Número de página (default: 1)
   * @param limit - Cantidad de resultados por página (default: 10, max: 50)
   * @returns Objeto con resultados paginados y metadata
   * 
   * @example
   * ```typescript
   * const results = await newsService.searchByKeyword('tecnología', 1, 10);
   * // { results: [...], total: 45, page: 1, totalPages: 5 }
   * ```
   */
  async searchByKeyword(
    q: string,
    page: number = 1,
    limit: number = 10
  ): Promise<IPaginatedResponse<INews>> {
    // Validar que el término de búsqueda no esté vacío
    if (!q || q.trim().length === 0) {
      return { results: [], total: 0, page: 1, totalPages: 0 };
    }

    // Construir patrón de búsqueda tolerante a acentos
    const sanitizedQuery = this.buildSearchPattern(q.trim());

    // Validar y normalizar parámetros de paginación
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(50, Math.max(1, limit)); // Max 50 resultados

    return this.newsRepository.searchByKeyword(sanitizedQuery, {
      page: normalizedPage,
      limit: normalizedLimit
    });
  }

  /**
   * Construye un patrón de búsqueda tolerante a acentos
   * @param query - Query sin sanitizar
   * @returns Patrón regex seguro con clases de caracteres
   */
  private buildSearchPattern(query: string): string {
    const safeQuery = query.substring(0, 100);
    const diacriticMap: Record<string, string> = {
      a: '[aáàâäãå]',
      e: '[eéèêë]',
      i: '[iíìîï]',
      o: '[oóòôöõ]',
      u: '[uúùûü]',
      n: '[nñ]',
      c: '[cç]'
    };

    const pattern = Array.from(safeQuery)
      .map((char) => {
        const baseChar = char
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        const mapped = diacriticMap[baseChar];
        if (mapped) {
          return mapped;
        }

        if (/[.*+?^${}()|[\]\\]/.test(char)) {
          return `\\${char}`;
        }

        return char;
      })
      .join('');

    return pattern;
  }
}