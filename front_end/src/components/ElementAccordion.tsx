import React, { useState } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { OsmElement } from "../objects";
import ElementAccordionItemContent from "./ElementAccordionItemContent";
import TagsModal from "./modals/TagsModal";
import cancel from "../assets/cancel.svg";
import edit from "../assets/edit.svg";
import Icon from "./Icon";

interface ElementAccordionProps {
  elements: OsmElement[];
  onRemoveWay?: (index: number) => void;
  onUpdateTags?: (
    index: number,
    tags: Record<string, string | undefined>,
  ) => void;
  editable?: boolean;
}

const ElementAccordion: React.FC<ElementAccordionProps> = ({
  elements,
  onRemoveWay = () => {},
  onUpdateTags = () => {},
  editable = false,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleUpdateTags = (
    updatedTags: Record<string, string | undefined>,
  ) => {
    if (editingIndex !== null) {
      onUpdateTags(editingIndex, updatedTags);
      setEditingIndex(null);
    }
  };

  if (elements.length === 0) {
    return <p className="text-gray-500 text-center">No ways selected</p>;
  }

  return (
    <>
      <TagsModal
        isOpen={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        tags={editingIndex !== null ? elements[editingIndex].tags : {}}
        onUpdate={handleUpdateTags}
      />
      <Accordion
        isCompact
        selectionMode="multiple"
        selectedKeys={expandedKeys}
        onSelectionChange={(keys) => setExpandedKeys(keys as Set<string>)}
      >
        {elements.map((element, index) => {
          const isExpanded = expandedKeys.has(element.id.toString());

          return (
            <AccordionItem
              key={element.id}
              aria-label={`${element.type} ${element.id}`}
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    {element.tags?.name ? (
                      <span className="font-medium">{element.tags.name}</span>
                    ) : (
                      <span className="text-gray-500 font-medium">
                        {element.type}/{element.id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center h-full">
                    <span className="text-gray-500 text-sm hidden md:inline">
                      {element.tags.amenity ||
                        element.tags.shop ||
                        element.tags.tourism ||
                        element.tags.office ||
                        element.type}
                    </span>
                    {editable && (
                      <>
                        <Tooltip
                          content={`Edit tags for ${element.type}/${element.id}`}
                        >
                          <Button
                            isIconOnly
                            onPress={() => {
                              setEditingIndex(index);
                            }}
                            className="ml-4 hover:bg-primary p-2 rounded-full"
                            aria-label="Edit tags"
                          >
                            <Icon src={edit} alt="edit tags" size="w-5 h-5" />
                          </Button>
                        </Tooltip>
                        <Tooltip
                          content={`Delete edits to ${element.type}/${element.id}`}
                        >
                          <Button
                            isIconOnly
                            onPress={() => {
                              onRemoveWay(index);
                            }}
                            className="ml-2 hover:bg-danger p-2 rounded-full"
                            aria-label="Remove way"
                          >
                            <Icon src={cancel} alt="cancel" size="w-5 h-5" />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
              }
            >
              <ElementAccordionItemContent
                element={element}
                isExpanded={isExpanded}
              />
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
};

export default ElementAccordion;
