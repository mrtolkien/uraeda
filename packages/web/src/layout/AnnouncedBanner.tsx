import { Banner, type BannerProps } from "@astryxdesign/core/Banner";

/**
 * A banner a screen reader announces: an error as an alert, any other status as a status. Astryx
 * 0.7 stopped deriving a banner's live role from its status, so every error banner, and every
 * banner that tells the outcome of an action, goes through here. A banner that only mirrors a
 * page's lasting state stays a plain `Banner`.
 */
export function AnnouncedBanner(props: BannerProps) {
  return <Banner role={props.status === "error" ? "alert" : "status"} {...props} />;
}
