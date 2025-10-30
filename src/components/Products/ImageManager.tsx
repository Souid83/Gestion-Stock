import React, { useState, useRef, DragEvent } from 'react';
import { X, Image as ImageIcon, Upload } from 'lucide-react';

interface ImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesChange: (images: string[]) => void;
  currentImages: string[];
}

export const ImageManager: React.FC<ImageManagerProps> = ({
  isOpen,
  onClose,
  onImagesChange,
  currentImages
}) => {
  const [error, setError] = useState('');
  const [images, setImages] = useState<string[]>(currentImages);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const processFiles = async (files: FileList) => {
    setIsUploading(true);
    setError('');

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Format de fichier non supporté. Veuillez sélectionner uniquement des images.');
        continue;
      }

      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const newImages = [...images, e.target.result as string];
            setImages(newImages);
            onImagesChange(newImages);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError('Erreur lors du chargement de l\'image');
        console.error('Error uploading file:', err);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Gestionnaire d'images</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              multiple
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload size={40} className={`mb-2 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className={`text-center ${isDragging ? 'text-blue-600' : 'text-gray-600'}`}>
                {isDragging ? 'Déposez vos images ici' : 'Cliquez pour sélectionner des images'}
              </span>
              <span className={`text-sm text-center ${isDragging ? 'text-blue-500' : 'text-gray-500'}`}>
                ou glissez-déposez vos fichiers ici
              </span>
            </label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="grid grid-cols-3 gap-4 mt-4">
            {images.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon size={48} className="text-gray-400 mb-2" />
                <p className="text-gray-500 text-center">
                  Aucune image ajoutée
                </p>
              </div>
            ) : (
              images.map((url, index) => (
                <div key={index} className="relative group aspect-square">
                  <img
                    src={url}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};