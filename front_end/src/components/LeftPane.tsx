import React, { useState, useEffect, useRef } from "react";
import { Card } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import RelationHeading from "./RelationHeading";
import LocationAutocomplete from "./LocationAutocomplete";
import NoRelationPlaceholder from "./NoRelationPlaceholder";
import TagComparisonTable from "./TagComparisonTable";
import CardHeading from "./CardHeading";
import LoginModal from "./modals/LoginModal";

import { OsmElement, OsmRelation, OsmWay, OsmMember, Tags } from "../objects";
import { useChangesetStore } from "../stores/useChangesetStore";
import { useElementStore } from "../stores/useElementStore";
import { fetchElementTags } from "../services/osmApi";
import { formatOsmId } from "../utils/osmHelpers";
import { useOsmAuthContext } from "../contexts/useOsmAuth";
import { matchingApi } from "../services/matchingApi";

interface LeftPaneProps {
  osmElements: OsmElement[];
  currentElement: number;
  isLoading: boolean;
  loadingMessage?: string;
  onNext: () => void;
}

const LeftPane: React.FC<LeftPaneProps> = ({
  osmElements,
  currentElement,
  isLoading,
  loadingMessage,
  onNext,
}) => {
  const { relation } = useChangesetStore();
  const { elementMatches, selectedMatchIndices, addToUpload, addSkippedOsmId } =
    useElementStore();
  const [liveTags, setLiveTags] = useState<Tags | null>(null);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagError, setTagError] = useState<string>("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { loggedIn, handleLogin } = useOsmAuthContext();

  // Cache for preloaded tags
  const tagsCache = useRef<
    Map<
      string,
      { tags: Tags; version: number; nodes?: number[]; members?: OsmMember[] }
    >
  >(new Map());
  const preloadAbortController = useRef<AbortController | null>(null);

  const currentOsmElement = osmElements[currentElement];
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

      const cacheKey = `${currentOsmElement.type}/${currentOsmElement.id}`;

      // Check if we have cached data from preloading
      const cached = tagsCache.current.get(cacheKey);
      if (cached) {
        setIsLoadingTags(false);
        setTagError("");
        setLiveTags(cached.tags);

        // Update element with cached data
        currentOsmElement.version = cached.version;
        if (currentOsmElement.type === "way" && cached.nodes) {
          (currentOsmElement as OsmWay).nodes = cached.nodes;
        } else if (currentOsmElement.type === "relation" && cached.members) {
          (currentOsmElement as OsmRelation).members = cached.members;
        }

        // Remove from cache after use
        tagsCache.current.delete(cacheKey);
        return;
      }

      setIsLoadingTags(true);
      setTagError("");
      setLiveTags(null);

      try {
        const elementData = await fetchElementTags(
          String(currentOsmElement.id),
          currentOsmElement.type,
        );
        currentOsmElement.version = elementData.version;
        if (currentOsmElement.type === "way" && elementData.nodes) {
          (currentOsmElement as OsmWay).nodes = elementData.nodes;
        } else if (
          currentOsmElement.type === "relation" &&
          elementData.members
        ) {
          (currentOsmElement as OsmRelation).members =
            elementData.members as OsmMember[];
        }
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

  // Preload next element's tags
  useEffect(() => {
    const preloadNextElement = async () => {
      // Cancel any ongoing preload
      if (preloadAbortController.current) {
        preloadAbortController.current.abort();
      }

      // Check if there's a next element
      const nextIndex = currentElement + 1;
      if (nextIndex >= osmElements.length) return;

      const nextElement = osmElements[nextIndex];
      if (!nextElement) return;

      const cacheKey = `${nextElement.type}/${nextElement.id}`;

      // Don't preload if already cached
      if (tagsCache.current.has(cacheKey)) return;

      // Create new abort controller for this preload
      preloadAbortController.current = new AbortController();

      try {
        const elementData = await fetchElementTags(
          String(nextElement.id),
          nextElement.type,
        );

        // Cache the result
        tagsCache.current.set(cacheKey, {
          tags: elementData.tags,
          version: elementData.version,
          nodes: elementData.nodes,
          members: elementData.members as OsmMember[] | undefined,
        });
      } catch (error) {
        // Silently fail preloading - the element will be fetched normally when needed
        if (error instanceof Error && error.name !== "AbortError") {
          console.log("Preload failed for next element, will fetch on demand");
        }
      }
    };

    // Only preload if we're not loading the current element
    if (!isLoadingTags && currentOsmElement && liveTags) {
      preloadNextElement();
    }

    // Cleanup on unmount
    return () => {
      if (preloadAbortController.current) {
        preloadAbortController.current.abort();
      }
    };
  }, [currentElement, osmElements, isLoadingTags, currentOsmElement, liveTags]);

  const handleApplyTags = (updatedTags: Tags) => {
    if (!loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
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

  const handleNoMatch = () => {
    if (!loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!currentMatches || !currentMatches[currentSelectedMatchIndex]) return;

    const overtureId = currentMatches[currentSelectedMatchIndex].overture_id;

    // Mark this Overture ID as skipped
    matchingApi.postOvertureElements([overtureId]);

    // Move to next element
    onNext();
  };

  const handleSkip = () => {
    if (!loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!currentOsmId) return;

    // Mark this OSM element as skipped
    addSkippedOsmId(currentOsmId);

    // Move to next element
    onNext();
  };

  const hasElements = osmElements && osmElements.length > 0;

  return (
    <>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={() => {
          handleLogin();
          setIsLoginModalOpen(false);
        }}
      />
      <div className="w-full md:w-2/3 relative">
        <div className="p-4 gap-4 flex flex-col md:h-full overflow-y-auto">
          <Card className="overflow-visible">
            <div className="p-4">
              {relation.id ? <RelationHeading /> : <LocationAutocomplete />}
            </div>
          </Card>

          {hasElements && (
            <div className="relative">
              <Divider className="my-4" />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background px-2">
                {currentElement + 1} of {osmElements.length}
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
                    <div className="px-2">
                      <CardHeading
                        name={
                          liveTags && liveTags.name ? liveTags.name : "Unnamed"
                        }
                        type={currentOsmElement.type}
                        id={currentOsmElement.id.toString()}
                      />
                    </div>

                    <TagComparisonTable
                      osmTags={liveTags}
                      matches={currentMatches}
                      onApplyTags={handleApplyTags}
                      onNoMatch={handleNoMatch}
                      onSkip={handleSkip}
                    />
                  </>
                ) : (
                  <Card className="p-4">
                    <p>No match data available</p>
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
              <div className="flex flex-col justify-center items-center mt-4 gap-2">
                <Spinner
                  color="primary"
                  size="lg"
                  label={loadingMessage || "Loading elements..."}
                />
              </div>
            ) : (
              <NoRelationPlaceholder />
            )}
          </div>
          <Divider
            orientation="horizontal"
            className="md:hidden absolute bottom-0 left-0 right-0"
          />
          <Divider
            orientation="vertical"
            className="hidden md:block absolute top-0 bottom-0 right-0"
          />
        </div>
      </div>
    </>
  );
};

export default LeftPane;
