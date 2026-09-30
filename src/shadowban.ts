type CheckState = "clear" | "banned" | "unknown" | "na";

export type ShadowbanItem = {
  state: CheckState;
  detail: string;
};

export type ShadowbanResult = {
  username: string;
  displayName: string;
  notFound: boolean;
  protected: boolean;
  suspended: boolean;
  tweetCount: number | null;
  checkedAt: string;
  checks: {
    mediaBan: ShadowbanItem;
    searchSensitiveBan: ShadowbanItem;
    searchSuggestionBan: ShadowbanItem;
    searchBan: ShadowbanItem;
    ghostBan: ShadowbanItem;
    replyDeboosting: ShadowbanItem;
  };
};

const PUBLIC_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

// Current x.com bundle IDs observed by XActions / TwitterInternalAPIDocument.
const USER_BY_SCREEN_NAME_ID = "Gb-d6r0vxPOADdG62OEBpQ";
const SEARCH_TIMELINE_ID = "hyPfJYJ_XAtDYoslQc-Rgg";

const USER_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  subscriptions_feature_can_gift_premium: true,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false
};

const SEARCH_FEATURES = {
  articles_preview_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  content_disclosure_indicator_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  post_ctas_fetch_enabled: false,
  premium_content_api_read_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_profile_redirect_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  rweb_cashtags_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  rweb_video_screen_enabled: false,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
  view_counts_everywhere_api_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweet_awards_web_tipping_enabled: false
};

const SEARCH_FIELD_TOGGLES = {
  withArticlePlainText: false,
  withArticleRichContentState: true,
  withArticleSummaryText: false,
  withArticleVoiceOver: false,
  withAuxiliaryUserLabels: false,
  withDisallowedReplyControls: false,
  withGrokAnalyze: false,
  withPayments: false
};

let guestToken: { value: string; expiresAt: number } | null = null;

class XApiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super("X API " + status + (detail ? ": " + detail : ""));
    this.name = "XApiError";
    this.status = status;
  }
}

function cleanUsername(value: string): string {
  const username = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    throw new Error("有効なXの垢のIDを入力してください");
  }
  return username;
}

async function fetchTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 5_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getGuestToken(): Promise<string> {
  if (guestToken && guestToken.expiresAt > Date.now() + 60_000) {
    return guestToken.value;
  }

  const response = await fetchTimeout(
    "https://api.x.com/1.1/guest/activate.json",
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + PUBLIC_BEARER,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT
      }
    }
  );

  if (!response.ok) {
    throw new XApiError(
      response.status,
      (await response.text().catch(() => "")).slice(0, 160)
    );
  }

  const body = (await response.json()) as { guest_token?: string };
  if (!body.guest_token) {
    throw new Error("Xの公開セッション取得結果が不正です");
  }

  guestToken = {
    value: String(body.guest_token),
    expiresAt: Date.now() + 2.5 * 60 * 60_000
  };
  return guestToken.value;
}

async function xGet(
  path: string,
  searchParams: Record<string, string>
): Promise<any> {
  const url = new URL(path, "https://x.com/i/api/");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetchTimeout(url, {
    headers: {
      accept: "*/*",
      authorization: "Bearer " + PUBLIC_BEARER,
      origin: "https://x.com",
      referer: "https://x.com/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": USER_AGENT,
      "x-guest-token": await getGuestToken(),
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "ja"
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("X側のレート制限中です");
    }
    throw new XApiError(response.status, detail.slice(0, 160));
  }

  return response.json();
}

function clear(detail: string): ShadowbanItem {
  return { state: "clear", detail };
}

function banned(detail: string): ShadowbanItem {
  return { state: "banned", detail };
}

function unknown(detail: string): ShadowbanItem {
  return { state: "unknown", detail };
}

function baseChecks(detail: string, state: CheckState): ShadowbanResult["checks"] {
  const item: ShadowbanItem = { state, detail };
  return {
    mediaBan: item,
    searchSensitiveBan: item,
    searchSuggestionBan: item,
    searchBan: item,
    ghostBan: item,
    replyDeboosting: item
  };
}

function displayNameFromUser(user: any, fallback: string): string {
  return String(
    user?.legacy?.name ??
      user?.core?.name ??
      user?.name ??
      fallback
  );
}

function searchTimelineHasOwnTweet(payload: any, username: string): boolean {
  const timeline =
    payload?.data?.search_by_raw_query?.search_timeline?.timeline;
  const instructions = Array.isArray(timeline?.instructions)
    ? timeline.instructions
    : [];

  for (const instruction of instructions) {
    const entries = Array.isArray(instruction?.entries)
      ? instruction.entries
      : [];
    for (const entry of entries) {
      if (!String(entry?.entryId ?? "").startsWith("tweet-")) continue;
      const screenName =
        entry?.content?.itemContent?.tweet_results?.result?.core?.user_results
          ?.result?.legacy?.screen_name;
      if (screenName === username) return true;
    }
  }
  return false;
}

async function checkSearchBan(username: string): Promise<ShadowbanItem> {
  try {
    const searchResponse = await xGet(
      "graphql/" + SEARCH_TIMELINE_ID + "/SearchTimeline",
      {
        variables: JSON.stringify({
          rawQuery: "from:" + username,
          count: 20,
          querySource: "typed_query",
          product: "Top"
        }),
        features: JSON.stringify(SEARCH_FEATURES),
        fieldToggles: JSON.stringify(SEARCH_FIELD_TOGGLES)
      }
    );

    return searchTimelineHasOwnTweet(searchResponse, username)
      ? clear("Top検索に本人のポストを確認できました")
      : banned("Top検索に本人のポストが見つかりませんでした");
  } catch (error) {
    if (error instanceof XApiError && error.status === 404) {
      return unknown(
        "現在のXでは未ログインセッションからSearchTimelineを利用できません"
      );
    }
    return unknown(
      "Top検索を取得できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

async function checkSearchSuggestion(
  username: string,
  displayName: string
): Promise<ShadowbanItem> {
  try {
    const suggestionResponse = await xGet(
      "1.1/search/typeahead.json",
      {
        include_ext_is_blue_verified: "1",
        include_ext_verified_type: "1",
        include_ext_profile_image_shape: "1",
        q: "@" + username + " " + displayName,
        src: "search_box",
        result_type: "events,users,topics,lists"
      }
    );

    const users = Array.isArray(suggestionResponse?.users)
      ? suggestionResponse.users
      : [];

    const found = users.some(
      (user: any) => user?.screen_name === username
    );

    return found
      ? clear("検索候補に本人のアカウントを確認できました")
      : banned("検索候補に本人のアカウントが見つかりませんでした");
  } catch (error) {
    return unknown(
      "検索候補を取得できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

export async function checkShadowban(
  input: string
): Promise<ShadowbanResult> {
  const requestedUsername = cleanUsername(input);

  const userResponse = await xGet(
    "graphql/" + USER_BY_SCREEN_NAME_ID + "/UserByScreenName",
    {
      variables: JSON.stringify({
        screen_name: requestedUsername,
        withGrokTranslatedBio: false
      }),
      features: JSON.stringify(USER_FEATURES),
      fieldToggles: JSON.stringify({
        withAuxiliaryUserLabels: false,
        withPayments: false
      })
    }
  );

  const user = userResponse?.data?.user;
  const result = user?.result ?? null;
  const checkedAt = new Date().toISOString();

  if (!user) {
    return {
      username: requestedUsername,
      displayName: requestedUsername,
      notFound: true,
      protected: false,
      suspended: false,
      tweetCount: null,
      checkedAt,
      checks: baseChecks("ユーザーが見つかりませんでした", "na")
    };
  }

  if (!result || result.__typename !== "User") {
    return {
      username: requestedUsername,
      displayName: displayNameFromUser(result, requestedUsername),
      notFound: false,
      protected: false,
      suspended: true,
      tweetCount: null,
      checkedAt,
      checks: baseChecks("ユーザーが凍結されています", "na")
    };
  }

  const legacy = result.legacy ?? {};
  const username = String(legacy.screen_name ?? requestedUsername);
  const displayName = displayNameFromUser(result, username);
  const tweetCount = Number.isFinite(Number(legacy.statuses_count))
    ? Number(legacy.statuses_count)
    : null;

  if (legacy.protected) {
    return {
      username,
      displayName,
      notFound: false,
      protected: true,
      suspended: false,
      tweetCount,
      checkedAt,
      checks: baseChecks("非公開アカウントのため判定対象外です", "na")
    };
  }

  const [searchBan, searchSuggestionBan] = await Promise.all([
    checkSearchBan(username),
    checkSearchSuggestion(username, displayName)
  ]);

  return {
    username,
    displayName,
    notFound: false,
    protected: false,
    suspended: false,
    tweetCount,
    checkedAt,
    checks: {
      mediaBan: unknown("現行IRithのサーバー側判定式は公開されていません"),
      searchSensitiveBan: unknown(
        "現行IRithのサーバー側判定式は公開されていません"
      ),
      searchSuggestionBan,
      searchBan,
      ghostBan: unknown("本家では現在メンテナンス中です"),
      replyDeboosting: unknown("本家では現在メンテナンス中です")
    }
  };
}
