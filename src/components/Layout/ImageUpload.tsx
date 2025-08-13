import React, { useState } from 'react';
import { uploadProductImages } from '../../config/cloudinary';

interface ImageUploadProps {
  onUploadSuccess: (images: any[]) => void;
  multiple?: boolean;
  maxFiles?: number;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUploadSuccess, 
  multiple = true, 
  maxFiles = 5 
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (files: FileList) => {
    setUploading(true);
    
    try {
      const fileArray = Array.from(files);
      const uploadPromises = fileArray.map(async (file, index) => {
        const buffer = await file.arrayBuffer();
        const result = await uploadProductImages(
          Buffer.from(buffer),
          `product-${Date.now()}-${index}`,
          file.name
        );
        
        setProgress(((index + 1) / fileArray.length) * 100);
        return result;
      });

      const results = await Promise.all(uploadPromises);
      onUploadSuccess(results);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="image-upload-container">
      <input
        type="file"
        multiple={multiple}
        accept="image/*"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        disabled={uploading}
      />
      
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress.toFixed(0)}% uploaded</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
