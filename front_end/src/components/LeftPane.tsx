import React, { useState, useEffect } from "react";
import { Card } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import RelationHeading from "./RelationHeading";
import LocationAutocomplete from "./LocationAutocomplete";
import NoRelationPlaceholder from "./NoRelationPlaceholder";
import TagComparisonTable from "./TagComparisonTable";
import { OsmElement, Tags } from "../objects";
import { useChangesetStore } from "../stores/useChangesetStore";
import { useElementStore } from "../stores/useElementStore";
import { fetchElementTags } from "../services/osmApi";
import { formatOsmId } from "../utils/osmHelpers";

interface LeftPaneProps {
  showRelationHeading: boolean;
  overpassElements: OsmElement[];
  currentElement: number;
  isLoading: boolean;
  onNext: () => void;
}

const LeftPane: React.FC<LeftPaneProps> = ({
  showRelationHeading,
  overpassElements,
  currentElement,
  isLoading,
  onNext,
}) => {
  const { relation } = useChangesetStore();
  const {
    elementMatches,
    selectedMatchIndices,
    addToUpload,
    addSkippedOvertureId,
    setSelectedMatchIndex,
  } = useElementStore();
  const [liveTags, setLiveTags] = useState<Tags | null>(null);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagError, setTagError] = useState<string>("");

  const currentOsmElement = overpassElements[currentElement];
  const currentOsmId = currentOsmElement
    ? formatOsmId(currentOsmElement)
    : null;
  const currentMatches = currentOsmId
    ? elementMatches.get(currentOsmId)
    : undefined;
  const currentSelectedMatchIndex = currentOsmId
    ? (selectedMatchIndices.get(currentOsmId) ?? 0)
    : 0;

  // Fetch live OSM tags when element changes
  useEffect(() => {
    const fetchLiveTags = async () => {
      if (!currentOsmElement) return;

      setIsLoadingTags(true);
      setTagError("");
      setLiveTags(null);

      try {
        const elementData = await fetchElementTags(
          String(currentOsmElement.id),
          currentOsmElement.type,
        );
        setLiveTags(elementData.tags);
      } catch (error) {
        setTagError(
          `Failed to fetch live tags: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        // Fallback to Overpass tags if live fetch fails
        setLiveTags(currentOsmElement.tags);
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchLiveTags();
  }, [currentOsmElement]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleApplyTags = (updatedTags: Tags, _selectedMatchIndex: number) => {
    if (!currentOsmElement) return;

    // Update the element with new tags
    const updatedElement = {
      ...currentOsmElement,
      tags: updatedTags,
    };

    // Add to upload queue
    addToUpload(updatedElement);

    // Move to next element
    onNext();
  };

  const handleSkipMatch = (matchIndex: number) => {
    if (!currentMatches || !currentMatches[matchIndex]) return;

    const overtureId = currentMatches[matchIndex].overture_id;

    // Mark this Overture ID as skipped
    addSkippedOvertureId(overtureId);

    // Move to next element
    onNext();
  };

  const handleMatchSelectionChange = (matchIndex: number) => {
    if (!currentOsmId) return;
    setSelectedMatchIndex(currentOsmId, matchIndex);
  };

  const hasElements = overpassElements && overpassElements.length > 0;

  return (
    <div className="w-full md:w-1/2 lg:w-2/5 p-4 border-b md:border-r border-gray-200 gap-4 flex flex-col md:h-full overflow-y-auto">
      <Card>
        <div className="p-4">
          {relation.id && showRelationHeading ? (
            <RelationHeading />
          ) : (
            <LocationAutocomplete />
          )}
        </div>
      </Card>

      {hasElements && (
        <div className="relative">
          <Divider className="my-4" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background px-2">
            {currentElement + 1} of {overpassElements.length}
          </div>
        </div>
      )}

      <div className="gap-2 flex flex-col md:grow">
        {hasElements ? (
          <>
            {isLoadingTags ? (
              <div className="flex justify-center items-center mt-4">
                <Spinner label="Loading element tags..." color="primary" />
              </div>
            ) : tagError ? (
              <Card className="p-4 bg-red-50">
                <p className="text-red-600 text-sm">{tagError}</p>
                <Button
                  size="sm"
                  color="primary"
                  className="mt-2"
                  onPress={onNext}
                >
                  Skip to Next
                </Button>
              </Card>
            ) : liveTags && currentMatches ? (
              <>
                <Card className="p-3 bg-blue-50">
                  <h3 className="text-sm font-semibold mb-1">
                    Current Element
                  </h3>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="font-medium">OSM ID:</span>{" "}
                      <span className="font-mono">{currentOsmId}</span>
                    </div>
                    {liveTags.name && (
                      <div>
                        <span className="font-medium">Name:</span>{" "}
                        {liveTags.name}
                      </div>
                    )}
                    {liveTags.amenity && (
                      <div>
                        <span className="font-medium">Amenity:</span>{" "}
                        {liveTags.amenity}
                      </div>
                    )}
                  </div>
                </Card>

                <TagComparisonTable
                  osmTags={liveTags}
                  matches={currentMatches}
                  selectedMatchIndex={currentSelectedMatchIndex}
                  onMatchSelectionChange={handleMatchSelectionChange}
                  onApplyTags={handleApplyTags}
                  onSkipMatch={handleSkipMatch}
                />
              </>
            ) : (
              <Card className="p-4">
                <p className="text-gray-500">No match data available</p>
                <Button
                  size="sm"
                  color="primary"
                  className="mt-2"
                  onPress={onNext}
                >
                  Skip to Next
                </Button>
              </Card>
            )}
          </>
        ) : isLoading ? (
          <div className="flex justify-center items-center mt-4">
            <Spinner label="Loading elements..." color="primary" />
          </div>
        ) : (
          <NoRelationPlaceholder />
        )}
      </div>
    </div>
  );
};

export default LeftPane;
