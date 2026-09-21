import type { Request, Response } from 'express';

import { uploadImageBuffer } from '../config/cloudinary.js';
import type {
    CreateNewsRequestDto,
    UpdateNewsRequestDto,
    NewsQueryRequestDto,
    NewsIdRequestDto,
    NewsByCategoryRequestDto,
    SearchNewsRequestDto,
    NewsPaginationQueryDto
} from '../dtos/news.dto.js';
import { toNewsResponseDto, toNewsPublicResponseDto } from '../dtos/news.dto.js';
import { successResponse } from '../dtos/response.dto.js';
import { AppError } from '../errors/AppError.js';
import { CategoryService } from '../services/category.services.js';
import { NewsService } from '../services/news.services.js';

export class NewsController {
    private newsService: NewsService;
    private categoryService: CategoryService;

    constructor(newsService?: NewsService, categoryService?: CategoryService) {
        this.newsService = newsService || new NewsService();
        this.categoryService = categoryService || new CategoryService();
        
        this.getNews = this.getNews.bind(this);
        this.createNews = this.createNews.bind(this);
        this.getNewsById = this.getNewsById.bind(this);
        this.getNewsByCategory = this.getNewsByCategory.bind(this);
        this.searchNews = this.searchNews.bind(this);
        this.editNews = this.editNews.bind(this);
        this.deleteNews = this.deleteNews.bind(this);
    }

    /**
     * @route GET /api/news
     * @description Obtiene el listado paginado de noticias. Permite filtros de búsqueda avanzados.
     * @returns {Promise<Response>} 200 - Colección paginada de resultados de noticias (DTO público)
     */
    async getNews(req: Request, res: Response): Promise<Response> {
        const query = res.locals.validated?.query as NewsQueryRequestDto | undefined;
        const pagination = res.locals.validated?.query as NewsPaginationQueryDto | undefined;
        const userRole = (req as any).user?.role;
        
        const result = await this.newsService.getNewsPaginated(query, {
            page: pagination?.page || 1,
            limit: pagination?.limit || 10
        }, userRole);
        
        const payload = {
            items: result.results.map(toNewsPublicResponseDto),
            pagination: {
                total: result.total,
                page: result.page,
                limit: pagination?.limit || 10,
                totalPages: result.totalPages
            }
        };
        return res.status(200).json(successResponse(payload));
    }

    /**
     * @route POST /api/news
     * @description Crea un reporte de noticia asociado al usuario en sesión. Procesa imágenes multer-storage.
     * @throws {AppError} 401 si no hay sesión.
     * @returns {Promise<Response>} 201 - DTO del reporte guardado
     */
    async createNews(req: Request, res: Response): Promise<Response> {
        const newsData = res.locals.validated.body as CreateNewsRequestDto;
        const user = (req as any).user;
        
        if (!user || !user._id) {
            throw new AppError('Usuario no autenticado', 401, 'UNAUTHENTICATED');
        }

        if (req.file) {
            newsData.mainImage = await uploadImageBuffer(req.file.buffer);
        }

        const newNews = await this.newsService.createNews(newsData, user._id);
        const payload = toNewsResponseDto(newNews);
        return res
            .status(201)
            .json(successResponse(payload, 'Noticia creada exitosamente'));
    }

    /**
     * @route GET /api/news/:id
     * @description Devuelve una Noticia por ID de MongoDB.
     * @throws {AppError} 404 - Noticia no Encontrada
     * @returns {Promise<Response>} 200 - DTO Público de Noticia
     */
    async getNewsById(req: Request, res: Response): Promise<Response> {
        const { id } = res.locals.validated.params as NewsIdRequestDto;
        const news = await this.newsService.getNewsById(id);

        if (!news) {
            throw new AppError('Noticia no encontrada', 404, 'NEWS_NOT_FOUND');
        }

        return res.status(200).json(successResponse(toNewsPublicResponseDto(news))); // DTO público
    }

    /**
     * @route GET /api/news/category
     * @description Extrae todas las noticias filtrando implícitamente por el Query Parameter `category`.
     * @throws {AppError} 404 - Si la categoría es inválida o no existe en la base de datos.
     * @returns {Promise<Response>} 200 - Colección de DTOs Públicos
     */
    async getNewsByCategory(req: Request, res: Response): Promise<Response> {
        const { category } = res.locals.validated.query as NewsByCategoryRequestDto;
        
        // Validar que la categoría existe
        const categoryExists = await this.categoryService.getCategoryById(category);
        if (!categoryExists) {
            throw new AppError(
                'Categoría no encontrada', 
                404, 
                'CATEGORY_NOT_FOUND'
            );
        }
        
        // Buscar noticias de la categoría (puede ser array vacío)
        const news = await this.newsService.getNewsByCategory(category);
        const payload = news.map(toNewsPublicResponseDto); // DTO público
        return res.status(200).json(successResponse(payload));
    }

    /**
     * @route GET /api/news/search
     * @description Ejecuta una consulta de regex parcial tolerante a acentos sobre el cuerpo y título de noticias.
     * @returns {Promise<Response>} 200 - Paginación customizada de respuestas de búsqueda.
     */
    async searchNews(req: Request, res: Response): Promise<Response> {
        const { q, page, limit } = res.locals.validated.query as SearchNewsRequestDto;
        
        const result = await this.newsService.searchByKeyword(
            q,
            page || 1,
            limit || 10
        );
        
        const payload = result.results.map(toNewsPublicResponseDto);
        
        return res.status(200).json(
            successResponse(
                {
                    items: payload,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: limit || 10,
                        totalPages: result.totalPages
                    },
                    query: q
                },
                `Se encontraron ${result.total} resultado(s) para "${q}"`
            )
        );
    }

    /**
     * @route PUT /api/news/:id
     * @description Edita una noticia por ID en DB solo si el solicitante es el dueño o admin/superadmin.
     * @throws {AppError} 403 - No tiene permisos
     * @returns {Promise<Response>} 200 - DTO Privado Modificado
     */
    async editNews(req: Request, res: Response): Promise<Response> {
        const { id } = res.locals.validated.params as NewsIdRequestDto;
        const newsData = res.locals.validated.body as UpdateNewsRequestDto;
        const user = (req as any).user;

        if (req.file) {
            newsData.mainImage = await uploadImageBuffer(req.file.buffer);
        }

        const edited = await this.newsService.editNews(
            id,
            newsData,
            user?._id,
            user?.role
        );

        const payload = toNewsResponseDto(edited);
        return res
            .status(200)
            .json(successResponse(payload, 'Noticia actualizada exitosamente'));
    }

    /**
     * @route DELETE /api/news/:id
     * @description Elimina el documento de manera física. Requerimientos RBAC de editNews aplicados.
     * @throws {AppError} 403 - No tiene permisos
     * @returns {Promise<Response>} 200 - DTO de la noticia eliminada.
     */
    async deleteNews(req: Request, res: Response): Promise<Response> {
        const { id } = res.locals.validated.params as NewsIdRequestDto;
        const user = (req as any).user;

        const deletedNews = await this.newsService.deleteNews(
            id,
            user?._id,
            user?.role
        );

        const payload = toNewsResponseDto(deletedNews);
        return res
            .status(200)
            .json(successResponse(payload, 'Noticia eliminada exitosamente'));
    }
}

export const newsController = new NewsController();