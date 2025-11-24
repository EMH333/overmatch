import { create } from "xmlbuilder2";
import { OsmElement } from "../objects";
import { XMLBuilder } from "xmlbuilder2/lib/interfaces";

export const osmXmlBuilder = {
  /**
   * Convert OsmWay to OSM XML format
   */
  eleToXml(
    element: OsmElement,
    changeset: number,
    incrementVersion = false,
  ): XMLBuilder {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("way", {
      id: element.id,
      version: incrementVersion ? element.version + 1 : element.version,
      changeset: changeset,
    });

    // // Add node references
    // element.nodes.forEach((nodeId) => {
    //   doc.ele("nd", { ref: nodeId });
    // });

    // Add tags
    Object.entries(element.tags).forEach(([key, value]) => {
      if (value) {
        // Only add tag if value exists
        doc.ele("tag", { k: key, v: value });
      }
    });

    return doc;
  },

  createChangeSet(ways: OsmElement[], changeset: number): string {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("osmChange", {
      version: "0.6",
      generator: "overmatch",
    });

    // Iterate through ways
    ways.forEach((way) => {
      const wayElement = this.eleToXml(way, changeset, false);
      doc.ele("modify").import(wayElement); // Import the way element into the modify element
    });

    // Go back to root and end the document
    return doc
      .up() // Go back to osmChange
      .end({ prettyPrint: true, headless: true });
  },
};
