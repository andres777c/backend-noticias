import multer from 'multer';

// Los archivos se mantienen en memoria y el controlador los sube a Cloudinary.
// No se escribe nada al disco: en las plataformas de despliegue el sistema de
// archivos es efímero y lo que se guarde se pierde en cada reinicio.
const storage = multer.memoryStorage();

// Filtro para aceptar solo imágenes
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'));
  }
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB MAX
  }
});
