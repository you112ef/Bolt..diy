import React, { memo } from 'react'; // Import memo

interface SingleFilePreviewItemProps {
  file: File;
  imageData: string | undefined;
  onRemove: (index: number) => void; // Expects the original onRemove that takes an index
  index: number; // Index of the item
}

// New memoized component for individual file previews
const SingleFilePreviewItem = memo(
  ({ file, imageData, onRemove, index }: SingleFilePreviewItemProps) => {
    if (!imageData) {
      return null;
    }
    return (
      <div className="mr-2 relative">
        <div className="relative">
          <img
            src={imageData}
            alt={file.name}
            className="max-h-20 rounded-lg"
            loading="lazy"
            decoding="async"
          />
          <button
            onClick={() => onRemove(index)} // Call onRemove with the item's index
            className="absolute -top-1 -right-1 z-10 bg-black rounded-full w-5 h-5 shadow-md hover:bg-gray-900 transition-colors flex items-center justify-center"
          >
            <div className="i-ph:x w-3 h-3 text-gray-200" />
          </button>
          <div className="absolute bottom-0 w-full h-5 flex items-center px-2 rounded-b-lg text-bolt-elements-textTertiary font-thin text-xs bg-bolt-elements-background-depth-2">
            <span className="truncate">{file.name}</span>
          </div>
        </div>
      </div>
    );
  },
);
SingleFilePreviewItem.displayName = 'SingleFilePreviewItem';

interface FilePreviewProps {
  files: File[];
  imageDataList: string[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, imageDataList, onRemove }) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row overflow-x-auto mx-2 -mt-1 p-2 bg-bolt-elements-background-depth-3 border border-b-none border-bolt-elements-borderColor rounded-lg rounded-b-none">
      {files.map((file, index) => (
        <SingleFilePreviewItem
          key={file.name + file.size}
          file={file}
          imageData={imageDataList[index]}
          onRemove={onRemove} // Pass the original onRemove directly
          index={index}       // Pass the index
        />
      ))}
    </div>
  );
};

export default FilePreview;
