from obstore.store import S3Store


def get_latest_overture_release() -> str:
    store = S3Store("overturemaps-us-west-2", region="us-west-2", skip_signature=True)

    releases = store.list_with_delimiter("release/")

    latest = sorted(releases.get("common_prefixes"), reverse=True)[0]
    return str(latest).removeprefix("release/")


if __name__ == "__main__":
    print(get_latest_overture_release())
