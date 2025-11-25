import { create } from "xmlbuilder2";
import { OsmElement, OsmNode, OsmWay, OsmRelation } from "../objects";
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
    // Build attributes conditionally based on element type
    const baseAttrs = {
      id: element.id,
      version: incrementVersion ? element.version + 1 : element.version,
      changeset: changeset,
    };

    // Add lat/lon only for nodes
    const attrs =
      element.type === "node"
        ? {
            ...baseAttrs,
            lat: (element as OsmNode).lat,
            lon: (element as OsmNode).lon,
          }
        : baseAttrs;

    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele(
      element.type,
      attrs,
    );

    // Add node references
    if (element.type === "way") {
      (element as OsmWay).nodes.forEach((nodeId) => {
        doc.ele("nd", { ref: nodeId });
      });
    }

    if (element.type === "relation") {
      (element as OsmRelation).members.forEach((member) => {
        doc.ele("member", {
          type: member.type,
          ref: member.ref,
          role: member.role ? member.role : "",
        });
      });

      doc.ele("tag", { k: "type", v: "multipolygon" });
    }

    // Add tags
    Object.entries(element.tags).forEach(([key, value]) => {
      if (value) {
        // Only add tag if value exists
        doc.ele("tag", { k: key, v: value });
      }
    });

    return doc;
  },

  createChangeSet(elements: OsmElement[], changeset: number): string {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("osmChange", {
      version: "0.6",
      generator: "overmatch",
    });

    // Iterate through objects
    elements.forEach((element) => {
      const modifyElement = this.eleToXml(element, changeset, false);
      doc.ele("modify").import(modifyElement); // Import the element into the modify element
    });

    // Go back to root and end the document
    return doc
      .up() // Go back to osmChange
      .end({ prettyPrint: true, headless: true });
  },
};
