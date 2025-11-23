import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import upload from "../assets/upload.svg";
import { uploadChanges } from "../services/upload";
import { OsmElement } from "../objects";
import { useChangesetStore } from "../stores/useChangesetStore";
import Icon from "./Icon";

interface UploadButtonProps {
  uploads: OsmElement[];
  setUploadWays: (ways: OsmElement[]) => void;
  setChangeset: (changeset: number) => void | Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  isLoading?: boolean;
}

const UploadButton: React.FC<UploadButtonProps> = ({
  uploads,
  setUploadWays,
  setChangeset,
  setError,
  isLoading: externalLoading = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const { description, databaseVersion, host } = useChangesetStore();

  const handleUpload = async (uploads: OsmElement[]) => {
    try {
      setIsUploading(true);
      const changeset = await uploadChanges(
        uploads as any, // TODO: Update uploadChanges to handle OsmElement
        description,
        databaseVersion,
        host,
      );
      await setChangeset(changeset);
      setUploadWays([]);
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Error uploading OSM data: " + error);
    } finally {
      setIsUploading(false);
    }
  };

  const isButtonDisabled =
    uploads.length === 0 || isUploading || externalLoading;

  return (
    <Button
      variant="flat"
      color="primary"
      className="w-full hover:border-2 hover:border-primary"
      isDisabled={isButtonDisabled}
      isLoading={isUploading}
      startContent={!isUploading && <Icon src={upload} alt="upload" />}
      onPress={() => handleUpload(uploads)}
    >
      Upload
      <Chip color="primary" variant="flat">
        {uploads ? uploads.length : 0}
      </Chip>
    </Button>
  );
};

export default UploadButton;
