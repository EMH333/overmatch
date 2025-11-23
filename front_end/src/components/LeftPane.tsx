import React from "react";
import { Card } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import RelationHeading from "./RelationHeading";
import LocationAutocomplete from "./LocationAutocomplete";
import NoRelationPlaceholder from "./NoRelationPlaceholder";
import { OsmElement } from "../objects";
import { useChangesetStore } from "../stores/useChangesetStore";

interface LeftPaneProps {
  showRelationHeading: boolean;
  overpassElements: OsmElement[];
  setOverpassElements: (ways: OsmElement[]) => void;
  currentElement: number;
  isLoading: boolean;
}

const LeftPane: React.FC<LeftPaneProps> = ({
  showRelationHeading,
  overpassElements,
  setOverpassElements,
  currentElement,
  isLoading,
}) => {
  const { relation } = useChangesetStore();

  const handleTagsUpdate = (
    updatedTags: Record<string, string | undefined>,
  ) => {
    const updatedElements = [...overpassElements];
    updatedElements[currentElement] = {
      ...updatedElements[currentElement],
      tags: updatedTags,
    };
    setOverpassElements(updatedElements);
  };

  const hasElements = overpassElements && overpassElements.length > 0;

  return (
    <div className="w-full md:w-1/3 p-4 border-b md:border-r border-gray-200 gap-4 flex flex-col md:h-full">
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

      <div className="px-4 gap-2 flex flex-col md:grow">
        {hasElements ? (
          <ElementEditor
            way={overpassElements[currentElement]}
            onTagsUpdate={handleTagsUpdate}
          />
        ) : isLoading ? (
          <div className="flex justify-center items-center mt-4">
            <Spinner label="Loading ways..." color="primary" />
          </div>
        ) : (
          <NoRelationPlaceholder />
        )}
      </div>
    </div>
  );
};

export default LeftPane;
