import React, { useState } from "react";
import BaseModal from "./BaseModal";
import { Link } from "@heroui/link";
import { Card } from "@heroui/card";
import UploadButton from "../UploadButton";
import ElementAccordion from "../ElementAccordion";
import CountBadge from "../ReviewCountBadge";
import { OsmElement } from "../../objects";
import ChangesetTagTable from "../ChangesetTags";
import ConfirmationModal from "./ConfirmationModal";
import { useOsmAuthContext } from "../../contexts/useOsmAuth";
import { useChangesetStore } from "../../stores/useChangesetStore";
import { matchingApi } from "../../services/matchingApi";
import { formatOsmId } from "../../utils/osmHelpers";

interface UploadModalProps {
  show: boolean;
  ways: number;
  onClose: () => void;
  uploads: OsmElement[];
  setUploadElements: (elements: OsmElement[]) => void;
  setChangeset: React.Dispatch<React.SetStateAction<number>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
}

const UploadModal: React.FC<UploadModalProps> = ({
  show,
  ways,
  onClose,
  uploads,
  setUploadElements,
  setChangeset,
  setError,
}) => {
  const { databaseVersion, description } = useChangesetStore();
  const { osmUser } = useOsmAuthContext();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPostingToApi, setIsPostingToApi] = useState(false);

  const handleDiscard = () => {
    setUploadElements([]);
    onClose();
  };

  const handleUploadSuccess = async (changesetId: number) => {
    setChangeset(changesetId);
    setIsPostingToApi(true);

    try {
      // Post OSM element IDs to the matching API
      if (uploads.length > 0) {
        const osmIds = uploads.map(formatOsmId);
        await matchingApi.postOsmElements(osmIds);
        console.log("Successfully posted OSM elements to API");
      }
    } catch (error) {
      console.error("Failed to post to tracking API:", error);
      setError(
        "Upload succeeded but failed to update tracking database: " + error,
      );
    } finally {
      setIsPostingToApi(false);
    }
  };

  return (
    <>
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleDiscard}
        confirmText="Discard"
      >
        <p>
          This action cannot be undone. Are you sure you want to discard your
          edits?
        </p>
      </ConfirmationModal>
      <BaseModal
        modalType="wide"
        isOpen={show && uploads.length > 0}
        onClose={onClose}
        title={{
          label: "Ready to Upload?",
          colorClass: "text-blue-600 dark:text-blue-400",
          emoji: "🚀",
        }}
        subtitle="Time to make your changes permanent!"
        actions={[
          {
            label: "Cancel",
            color: "default",
            onClick: onClose,
          },
          {
            label: "Discard",
            color: "danger",
            onClick: () => {
              setIsConfirmModalOpen(true);
            },
            className: "mt-2 hover:border-2 hover:border-danger",
          },
        ]}
        contentClassName="max-h-[80vh] overflow-y-auto md:max-w-[80vh]"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <CountBadge count={ways} verb="reviewed" />
            <p className="text-center text-medium font-medium">
              The changes you upload as
              <Link
                className="px-1 hover:underline"
                target="_blank"
                href={`https://www.openstreetmap.org/user/${osmUser}`}
              >
                {osmUser}
              </Link>
              will be visible on all maps that use OpenStreetMap data.
            </p>

            <ChangesetTagTable
              databaseVersion={databaseVersion}
              description={description}
            />

            <Card className="rounded-lg p-4 w-full mx-4">
              <h3 className="text-lg font-semibold">Ways</h3>
              {uploads.length === 0 ? (
                <p className="text-gray-500 text-center">
                  No elements selected
                </p>
              ) : (
                <ElementAccordion
                  elements={uploads}
                  onRemoveWay={(index) => {
                    const newUploads = [...uploads];
                    newUploads.splice(index, 1);
                    setUploadElements(newUploads);
                  }}
                  editable={true}
                />
              )}
            </Card>
          </div>

          <UploadButton
            uploads={uploads}
            setUploadWays={setUploadElements}
            setChangeset={handleUploadSuccess}
            setError={setError}
            isLoading={isPostingToApi}
          />
          {isPostingToApi && (
            <p className="text-sm text-gray-600 text-center">
              Updating tracking database...
            </p>
          )}
        </div>
      </BaseModal>
    </>
  );
};

export default UploadModal;
