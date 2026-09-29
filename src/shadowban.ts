type CheckState = "clear" | "banned" | "unknown" | "na";

export type ShadowbanItem = {
  state: CheckState;
  detail: string;
};

export type ShadowbanResult = {
  username: string;
  displayName: string;
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
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const OPERATION_IDS: Record<
  "UserByScreenName" | "UserTweets" | "SearchTimeline" | "TweetDetail",
  string
> = {
  UserByScreenName: "Gb-d6r0vxPOADdG62OEBpQ",
  UserTweets: "SXVCYB8XHSS25nzIljNtZA",
  SearchTimeline: "hyPfJYJ_XAtDYoslQc-Rgg",
  TweetDetail: "XMOz5h24KAZ86qKffKTLdQ"
};

const FEATURES: Record<string, boolean> = {
  articles_preview_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  rweb_video_screen_enabled: false,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
  view_counts_everywhere_api_enabled: true
};

let guestToken: { value: string; expiresAt: number } | null = null;
let queryIdsRefreshedAt = 0;
let queryRefreshPromise: Promise<void> | null = null;

function cleanUsername(value: string): string {
  const username = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    throw new Error("有効なXユーザー名を入力してください");
  }
  return username;
}

async function fetchTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 3500
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
        Authorization: "Bearer " + decodeURIComponent(PUBLIC_BEARER),
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT
      }
    }
  );
  if (!response.ok) {
    throw new Error("Xの公開セッションを開始できませんでした");
  }

  const payload = (await response.json()) as { guest_token?: string };
  if (!payload.guest_token) {
    throw new Error("Xの公開セッション取得結果が不正です");
  }

  guestToken = {
    value: String(payload.guest_token),
    expiresAt: Date.now() + 2.5 * 60 * 60_000
  };
  return guestToken.value;
}

async function xHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: "Bearer " + decodeURIComponent(PUBLIC_BEARER),
    "X-Guest-Token": await getGuestToken(),
    "X-Twitter-Active-User": "yes",
    "X-Twitter-Client-Language": "ja",
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    Origin: "https://x.com",
    Referer: "https://x.com/"
  };
}

async function discoverCurrentQueryIds(): Promise<void> {
  if (Date.now() - queryIdsRefreshedAt < 5 * 60_000) return;
  if (queryRefreshPromise) return queryRefreshPromise;

  queryRefreshPromise = (async () => {
    const entryUrls = [
      "https://x.com/home",
      "https://x.com/i/flow/login",
      "https://twitter.com/home"
    ];

    const attempts = entryUrls.map(async (url) => {
      const response = await fetchTimeout(
        url,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          },
          redirect: "follow"
        },
        3000
      );
      if (!response.ok) throw new Error("entry HTTP " + response.status);
      const html = await response.text();
      const match = html.match(
        /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/main\.([a-z0-9]+)\.js/i
      );
      if (!match) throw new Error("main bundle not found");
      return match[0];
    });

    let mainUrl = "";
    try {
      mainUrl = await Promise.any(attempts);
    } catch {
      return;
    }

    try {
      const response = await fetchTimeout(
        mainUrl,
        { headers: { "User-Agent": USER_AGENT, Accept: "*/*" } },
        4500
      );
      if (!response.ok) return;
      const source = await response.text();
      const operationPattern =
        /queryId:"([A-Za-z0-9_-]+)",operationName:"([A-Za-z0-9_]+)",operationType:"(query|mutation|subscription)"/g;
      let updated = 0;
      for (const match of source.matchAll(operationPattern)) {
        const operationName = match[2] as keyof typeof OPERATION_IDS;
        if (operationName in OPERATION_IDS) {
          OPERATION_IDS[operationName] = match[1]!;
          updated++;
        }
      }
      if (updated > 0) queryIdsRefreshedAt = Date.now();
    } catch {
      // Keep the last known-good IDs.
    }
  })().finally(() => {
    queryRefreshPromise = null;
  });

  return queryRefreshPromise;
}

async function graphqlRequest(
  operationName: keyof typeof OPERATION_IDS,
  variables: Record<string, unknown>,
  retried = false
): Promise<any> {
  const queryId = OPERATION_IDS[operationName];
  const base =
    "https://x.com/i/api/graphql/" +
    encodeURIComponent(queryId) +
    "/" +
    encodeURIComponent(operationName);
  const headers = await xHeaders();
  let response: Response;

  if (operationName === "SearchTimeline") {
    response = await fetchTimeout(base, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        variables,
        features: FEATURES,
        queryId
      })
    });
  } else {
    const url = new URL(base);
    url.searchParams.set("variables", JSON.stringify(variables));
    url.searchParams.set("features", JSON.stringify(FEATURES));
    if (operationName === "UserByScreenName") {
      url.searchParams.set(
        "fieldToggles",
        JSON.stringify({ withAuxiliaryUserLabels: false })
      );
    }
    response = await fetchTimeout(url, { headers });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("X側のレート制限中です");
    }

    const staleId =
      response.status === 404 ||
      (response.status === 400 &&
        /query|persisted|operation/i.test(detail));
    if (!retried && staleId) {
      queryIdsRefreshedAt = 0;
      await discoverCurrentQueryIds();
      return graphqlRequest(operationName, variables, true);
    }

    throw new Error(
      "X公開エンドポイント " + response.status + ": " + detail.slice(0, 120)
    );
  }

  const payload = await response.json();
  const errorText =
    payload && typeof payload === "object" && "errors" in payload
      ? JSON.stringify((payload as any).errors ?? "")
      : "";

  if (!retried && /query|persisted|operation/i.test(errorText)) {
    queryIdsRefreshedAt = 0;
    await discoverCurrentQueryIds();
    return graphqlRequest(operationName, variables, true);
  }

  return payload;
}

type SearchTweet = {
  id: string;
  username: string | null;
  parentId: string | null;
  hasMedia: boolean;
  possiblySensitive: boolean | null;
};

function unwrapTweetResult(result: any): any {
  let value = result;
  for (let i = 0; i < 4; i++) {
    if (!value || typeof value !== "object") break;
    if (value.__typename === "TweetWithVisibilityResults" && value.tweet) {
      value = value.tweet;
      continue;
    }
    if (value.tweet) {
      value = value.tweet;
      continue;
    }
    break;
  }
  return value;
}

function tweetFromResult(result: any): SearchTweet | null {
  const tweet = unwrapTweetResult(result);
  const legacy = tweet?.legacy;
  const id = String(tweet?.rest_id ?? legacy?.id_str ?? "");
  if (!id || !legacy) return null;

  const username =
    tweet?.core?.user_results?.result?.legacy?.screen_name ??
    tweet?.core?.user_results?.result?.core?.screen_name ??
    tweet?.core?.user_results?.result?.screen_name ??
    null;

  const media =
    legacy?.extended_entities?.media ??
    legacy?.entities?.media ??
    [];

  return {
    id,
    username: username ? String(username) : null,
    parentId: legacy.in_reply_to_status_id_str
      ? String(legacy.in_reply_to_status_id_str)
      : null,
    hasMedia: Array.isArray(media) && media.length > 0,
    possiblySensitive:
      typeof legacy.possibly_sensitive === "boolean"
        ? legacy.possibly_sensitive
        : null
  };
}

function collectTweetResults(root: any): SearchTweet[] {
  const out: SearchTweet[] = [];
  const seenObjects = new Set<object>();
  const seenIds = new Set<string>();

  const walk = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    const result = value?.tweet_results?.result;
    if (result) {
      const parsed = tweetFromResult(result);
      if (parsed && !seenIds.has(parsed.id)) {
        seenIds.add(parsed.id);
        out.push(parsed);
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const child of Object.values(value)) walk(child);
  };

  walk(root);
  return out;
}

function sameUser(tweet: SearchTweet, username: string): boolean {
  return (
    typeof tweet.username === "string" &&
    tweet.username.toLowerCase() === username.toLowerCase()
  );
}

async function searchTweets(
  rawQuery: string,
  product: "Latest" | "Top" | "People",
  username: string
): Promise<SearchTweet[]> {
  const payload = await graphqlRequest("SearchTimeline", {
    rawQuery,
    count: 20,
    querySource: "typed_query",
    product
  });
  return collectTweetResults(payload).filter((tweet) =>
    sameUser(tweet, username)
  );
}

async function profileByUsername(username: string): Promise<{
  userId: string | null;
  displayName: string;
  protected: boolean;
  suspended: boolean;
  tweetCount: number | null;
}> {
  const payload = await graphqlRequest("UserByScreenName", {
    screen_name: username,
    withSafetyModeUserFields: true
  });
  const user = payload?.data?.user?.result;
  if (!user) throw new Error("Xアカウントが見つかりません");

  if (user.__typename !== "User") {
    const unavailableText = JSON.stringify(user).toLowerCase();
    if (!/suspend|withheld|unavailable/.test(unavailableText)) {
      throw new Error(
        "Xアカウントが見つからないか、公開情報を取得できません"
      );
    }
    return {
      userId: null,
      displayName: username,
      protected: false,
      suspended: true,
      tweetCount: null
    };
  }

  const legacy = user.legacy ?? {};
  const core = user.core ?? {};
  return {
    userId: user.rest_id ? String(user.rest_id) : null,
    displayName: String(legacy.name ?? core.name ?? username),
    protected: Boolean(legacy.protected),
    suspended: false,
    tweetCount:
      Number.isFinite(Number(legacy.statuses_count))
        ? Number(legacy.statuses_count)
        : null
  };
}

async function userTweets(
  userId: string,
  username: string
): Promise<SearchTweet[]> {
  const payload = await graphqlRequest("UserTweets", {
    userId,
    count: 20,
    includePromotedContent: true,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
    withV2Timeline: true
  });
  return collectTweetResults(payload).filter((tweet) =>
    sameUser(tweet, username)
  );
}

async function searchSuggestionVisible(
  username: string,
  displayName: string
): Promise<boolean> {
  const endpoints = [
    "https://x.com/i/api/1.1/search/typeahead.json",
    "https://api.x.com/1.1/search/typeahead.json"
  ];
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set(
        "q",
        ("@" + username + " " + displayName).trim()
      );
      url.searchParams.set("src", "search_box");
      url.searchParams.set("result_type", "events,users,topics,lists");
      url.searchParams.set("include_ext_is_blue_verified", "1");
      url.searchParams.set("include_ext_verified_type", "1");
      url.searchParams.set("include_ext_profile_image_shape", "1");

      const response = await fetchTimeout(url, {
        headers: await xHeaders()
      });
      if (!response.ok) {
        lastError = new Error("typeahead HTTP " + response.status);
        continue;
      }

      const payload = (await response.json()) as any;
      const users = Array.isArray(payload?.users) ? payload.users : [];
      return users.some(
        (user: any) =>
          String(user?.screen_name ?? "").toLowerCase() ===
          username.toLowerCase()
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("検索候補を取得できませんでした");
}

function collectShowMoreCursors(root: any): string[] {
  const cursors = new Set<string>();
  const seen = new Set<object>();

  const walk = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    const entryId = String(value.entryId ?? "");
    const cursorType = String(
      value.cursorType ??
        value?.content?.cursorType ??
        value?.itemContent?.cursorType ??
        ""
    );
    const cursorValue =
      value.value ??
      value?.content?.value ??
      value?.itemContent?.value ??
      null;

    if (
      cursorValue &&
      (/showmorethreads/i.test(cursorType) ||
        /cursor-showmorethreads/i.test(entryId))
    ) {
      cursors.add(String(cursorValue));
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const child of Object.values(value)) walk(child);
  };

  walk(root);
  return [...cursors];
}

async function tweetDetail(
  focalTweetId: string,
  cursor?: string
): Promise<any> {
  const variables: Record<string, unknown> = {
    focalTweetId,
    with_rux_injections: false,
    rankingMode: "Relevance",
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true
  };
  if (cursor) variables.cursor = cursor;
  return graphqlRequest("TweetDetail", variables);
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

function na(detail: string): ShadowbanItem {
  return { state: "na", detail };
}

export async function checkShadowban(
  input: string
): Promise<ShadowbanResult> {
  const username = cleanUsername(input);
  const profile = await profileByUsername(username);

  const checks: ShadowbanResult["checks"] = {
    mediaBan: unknown("まだ判定していません"),
    searchSensitiveBan: unknown("まだ判定していません"),
    searchSuggestionBan: unknown("まだ判定していません"),
    searchBan: unknown("まだ判定していません"),
    ghostBan: unknown("まだ判定していません"),
    replyDeboosting: unknown("まだ判定していません")
  };

  if (profile.suspended) {
    const item = unknown("アカウントが利用不能のため判定できません");
    return {
      username,
      displayName: profile.displayName,
      protected: false,
      suspended: true,
      tweetCount: profile.tweetCount,
      checkedAt: new Date().toISOString(),
      checks: {
        mediaBan: item,
        searchSensitiveBan: item,
        searchSuggestionBan: item,
        searchBan: item,
        ghostBan: item,
        replyDeboosting: item
      }
    };
  }

  if (profile.protected) {
    const item = na("非公開アカウントは外部検索から判定できません");
    return {
      username,
      displayName: profile.displayName,
      protected: true,
      suspended: false,
      tweetCount: profile.tweetCount,
      checkedAt: new Date().toISOString(),
      checks: {
        mediaBan: item,
        searchSensitiveBan: item,
        searchSuggestionBan: item,
        searchBan: item,
        ghostBan: item,
        replyDeboosting: item
      }
    };
  }

  if ((profile.tweetCount ?? 0) === 0) {
    const item = na("ポストがないため判定対象外です");
    return {
      username,
      displayName: profile.displayName,
      protected: false,
      suspended: false,
      tweetCount: profile.tweetCount,
      checkedAt: new Date().toISOString(),
      checks: {
        mediaBan: item,
        searchSensitiveBan: item,
        searchSuggestionBan: item,
        searchBan: item,
        ghostBan: item,
        replyDeboosting: item
      }
    };
  }

  const [searchResult, suggestionResult] = await Promise.allSettled([
    searchTweets("from:" + username, "Top", username),
    searchSuggestionVisible(username, profile.displayName)
  ]);

  if (searchResult.status === "rejected") {
    checks.searchBan = unknown(
      "Top検索を取得できません: " +
        (searchResult.reason instanceof Error
          ? searchResult.reason.message
          : String(searchResult.reason))
    );
  } else {
    checks.searchBan =
      searchResult.value.length > 0
        ? clear("Top検索に本人のポストを確認できました")
        : banned("Top検索に本人のポストが見つかりませんでした");
  }

  if (suggestionResult.status === "fulfilled") {
    checks.searchSuggestionBan = suggestionResult.value
      ? clear("検索候補に本人のアカウントを確認できました")
      : banned("検索候補に本人のアカウントが見つかりませんでした");
  } else {
    checks.searchSuggestionBan = unknown(
      "検索候補を取得できません: " +
        (suggestionResult.reason instanceof Error
          ? suggestionResult.reason.message
          : String(suggestionResult.reason))
    );
  }

  checks.mediaBan = unknown("現行本家の判定式は非公開です");
  checks.searchSensitiveBan = unknown("現行本家の判定式は非公開です");
  checks.ghostBan = unknown("本家では現在メンテナンス中です");
  checks.replyDeboosting = unknown("本家では現在メンテナンス中です");

  return {
    username,
    displayName: profile.displayName,
    protected: profile.protected,
    suspended: profile.suspended,
    tweetCount: profile.tweetCount,
    checkedAt: new Date().toISOString(),
    checks
  };
}
