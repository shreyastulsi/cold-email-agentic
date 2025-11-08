import { cn } from "@/libs/utils";
import { IconUpload } from "@tabler/icons-react";
import { motion } from "motion/react";
import React, { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

const mainVariant = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 20,
    y: -20,
    opacity: 1.0,
  },
};

const secondaryVariant = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
};

export const FileUpload = ({
  onChange,
  accept,
  maxSize,
  onError,
  key,
}: {
  onChange?: (files: File[]) => void;
  accept?: string | string[];
  maxSize?: number; // in bytes
  onError?: (error: string) => void;
  key?: string | number;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset files when key changes
  React.useEffect(() => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [key]);

  const handleFileChange = (newFiles: File[]) => {
    // Validate files
    const validFiles: File[] = [];
    for (const file of newFiles) {
      // Check file type if accept is specified
      if (accept) {
        const acceptTypes = Array.isArray(accept) ? accept : [accept];
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const isValidType = acceptTypes.some(type => 
          fileType === type || 
          fileExtension === type ||
          (type.startsWith('.') && fileExtension === type.toLowerCase())
        );
        if (!isValidType) {
          onError && onError(`Invalid file type. Please upload a ${acceptTypes.join(' or ')} file.`);
          continue;
        }
      }
      
      // Check file size if maxSize is specified
      if (maxSize && file.size > maxSize) {
        onError && onError(`File size must be less than ${(maxSize / (1024 * 1024)).toFixed(2)}MB`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      setFiles(validFiles);
      onChange && onChange(validFiles);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    accept: accept ? (typeof accept === 'string' ? { [accept]: [] } : accept.reduce((acc, type) => ({ ...acc, [type]: [] }), {})) : undefined,
    maxSize: maxSize,
    onDrop: handleFileChange,
    onDropRejected: (errors) => {
      const error = errors[0]?.errors[0];
      if (error) {
        if (error.code === 'file-too-large') {
          onError && onError(`File size must be less than ${maxSize ? (maxSize / (1024 * 1024)).toFixed(2) + 'MB' : 'the limit'}`);
        } else if (error.code === 'file-invalid-type') {
          onError && onError(`Invalid file type. Please upload a ${accept} file.`);
        } else {
          onError && onError(error.message || 'File upload failed');
        }
      }
    },
  });

  return (
    <div className="w-full" {...getRootProps()}>
      <motion.div
        onClick={handleClick}
        whileHover="animate"
        className="p-10 group/file block rounded-lg cursor-pointer w-full relative overflow-visible bg-gray-900/30 border-2 border-dashed border-gray-700/50 transition-colors"
      >
        <input
          ref={fileInputRef}
          id="file-upload-handle"
          type="file"
          accept={Array.isArray(accept) ? accept.join(',') : accept}
          onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center relative z-10">
          <p className="font-bold text-gray-300 text-base">
            {accept === 'application/pdf' ? 'Upload Resume PDF' : 'Upload file'}
          </p>
          <p className="font-normal text-gray-400 text-base mt-2">
            Drag or drop your files here or click to upload
          </p>
          <div className="relative w-full mt-10 max-w-xl mx-auto overflow-visible">
            {files.length > 0 &&
              files.map((file, idx) => (
                <motion.div
                  key={"file" + idx}
                  layoutId={idx === 0 ? "file-upload" : "file-upload-" + idx}
                  className={cn(
                    "relative overflow-hidden z-40 bg-gray-800/50 border border-gray-700/50 flex flex-col items-start justify-start md:h-24 p-4 mt-4 w-full mx-auto rounded-md",
                    "shadow-sm"
                  )}
                >
                  <div className="flex justify-between w-full items-center gap-4">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="text-base text-gray-300 truncate max-w-xs"
                    >
                      {file.name}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="rounded-lg px-2 py-1 w-fit shrink-0 text-sm bg-gray-700/50 text-gray-300"
                    >
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </motion.p>
                  </div>

                  <div className="flex text-sm md:flex-row flex-col items-start md:items-center w-full mt-2 justify-between text-gray-400">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="px-1 py-0.5 rounded-md bg-gray-700/50 text-gray-300"
                    >
                      {file.type || 'application/pdf'}
                    </motion.p>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="text-gray-400"
                    >
                      modified{" "}
                      {new Date(file.lastModified).toLocaleDateString()}
                    </motion.p>
                  </div>
                </motion.div>
              ))}
            {!files.length && (
              <div className="relative w-full max-w-[8rem] mx-auto mt-4 overflow-visible">
                {/* Blue dashed outline square behind upload icon - only visible on hover */}
                <div className="absolute -inset-[6px] rounded-lg border-2 border-dashed border-blue-500 opacity-0 group-hover/file:opacity-100 transition-opacity duration-200 pointer-events-none z-0" />
                <motion.div
                  layoutId="file-upload"
                  variants={mainVariant}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className={cn(
                    "relative group-hover/file:shadow-2xl z-10 bg-gray-800/50 group-hover/file:bg-gray-800 border border-gray-700/50 flex items-center justify-center h-32 w-full rounded-md transition-colors duration-200",
                    isDragActive && "border-blue-500 border-2"
                  )}
                >
                  {isDragActive ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-gray-300 flex flex-col items-center gap-2"
                    >
                      Drop it
                      <IconUpload className="h-5 w-5 text-blue-400" />
                    </motion.p>
                  ) : (
                    <IconUpload className="h-6 w-6 text-gray-400 group-hover/file:text-blue-400 transition-colors" />
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

