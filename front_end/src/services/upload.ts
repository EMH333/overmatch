import { OsmElement } from "../objects";
import { authFetch } from "../services/auth";
import { create } from "xmlbuilder2";
import { osmXmlBuilder } from "../services/xml";
import packageJson from "../../package.json";

export const uploadChanges = async (
  elements: OsmElement[],
  description: string,
  databaseVersion: string,
  host: string,
) => {
  const version = packageJson.version;

  const changeset = create()
    .ele("osm")
    .ele("changeset")
    .ele("tag")
    .att("k", "created_by")
    .att("v", "Overmatch " + version)
    .up()
    .ele("tag")
    .att("k", "source")
    .att(
      "v",
      `Overture Maps${databaseVersion ? ` (release ${databaseVersion})` : ""}`,
    )
    .up()
    .ele("tag")
    .att("k", "host")
    .att("v", host)
    .up()
    .ele("tag")
    .att("k", "comment")
    .att("v", description)
    .up()
    .up()
    .up();
  console.log(changeset.end({ prettyPrint: true, headless: true }));

  const changesetId: number = await authFetch({
    method: "PUT",
    path: "/api/0.6/changeset/create",
    options: { header: { "Content-Type": "text/xml; charset=utf-8" } },
    content: changeset.end({ headless: true }),
  });

  const xmlWays = osmXmlBuilder.createChangeSet(elements, changesetId);
  console.log(xmlWays);

  const diffResult: string = await authFetch({
    method: "POST",
    path: `/api/0.6/changeset/${changesetId}/upload`,
    options: { header: { "Content-Type": "text/xml; charset=utf-8" } },
    content: xmlWays,
  });

  authFetch({
    method: "PUT",
    path: `/api/0.6/changeset/${changesetId}/close`,
  });
  console.log(changesetId, diffResult);
  return changesetId;
};
