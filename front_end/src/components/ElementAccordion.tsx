import React, { useState } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { OsmElement } from "../objects";
import ElementAccordionItemContent from "./ElementAccordionItemContent";
import cancel from "../assets/cancel.svg";
import Icon from "./Icon";

interface ElementAccordionProps {
  elements: OsmElement[];
  onRemoveWay?: (index: number) => void;
  editable?: boolean;
}

const ElementAccordion: React.FC<ElementAccordionProps> = ({
  elements,
  onRemoveWay = () => {},
  editable = false,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (elements.length === 0) {
    return <p className="text-gray-500 text-center">No ways selected</p>;
  }

  return (
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
                      element.tags.highway ||
                      element.type}
                  </span>
                  {editable && (
                    <Button
                      isIconOnly
                      onPress={() => {
                        onRemoveWay(index);
                      }}
                      className="ml-4 hover:bg-danger p-2 rounded-full"
                      aria-label="Remove way"
                    >
                      <Icon src={cancel} alt="cancel" size="w-5 h-5" />
                    </Button>
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
  );
};

export default ElementAccordion;
