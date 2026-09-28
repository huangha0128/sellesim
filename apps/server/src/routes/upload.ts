import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

/**
 * 退款凭证图片上传：图片直接以二进制存入共享 MySQL（Upload 表），
 * 不落本地磁盘 —— 线上 /api 由多台后端负载均衡，两机文件系统相互独立，
 * 存盘会导致「A 机上传、B 机读取 404」，存库则任意实例都能读到。
 */

/** 客户端可直接访问的 URL 前缀 */
export const UPLOAD_URL_PREFIX = '/api/uploads';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 单张图片上限 5MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('仅支持 JPG / PNG / WEBP 图片'));
  },
});

export default (prisma: PrismaClient) => {
  const router = Router();

  /**
   * POST /api/uploads/image 上传退款凭证图片（需登录）
   * form-data 字段名固定为 file，返回可直接访问的相对 URL
   */
  router.post('/image', authMiddleware, (req: AuthRequest, res: Response) => {
    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        const msg =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? '图片不能超过 5MB'
            : err.message || '图片上传失败';
        return res.json({ code: 1, message: msg });
      }
      const file = (req as any).file;
      if (!file) {
        return res.json({ code: 1, message: '请选择要上传的图片' });
      }
      try {
        const row = await prisma.upload.create({
          data: {
            mime: ALLOWED_MIME[file.mimetype] || 'image/jpeg',
            size: file.size,
            data: file.buffer,
          },
        });
        res.json({ code: 0, data: { url: `${UPLOAD_URL_PREFIX}/${row.id}` } });
      } catch (e: any) {
        console.error('[upload] 凭证图片保存失败：', e.message);
        res.json({ code: 1, message: '图片上传失败，请稍后重试' });
      }
    });
  });

  /**
   * GET /api/uploads/:id 读取凭证图片（免鉴权，URL 为不可猜的 UUID）
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const row = await prisma.upload.findUnique({ where: { id: req.params.id } });
      if (!row) {
        return res.status(404).end();
      }
      res.setHeader('Content-Type', row.mime);
      // 图片内容不可变，允许浏览器/客户端长期缓存
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(Buffer.from(row.data));
    } catch (e: any) {
      console.error(`[upload] 凭证图片 ${req.params.id} 读取失败：`, e.message);
      res.status(500).end();
    }
  });

  return router;
};