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

const OPERATION_IDS: Record<string, string> = {
  UserByScreenName: "Gb-d6r0vxPOADdG62OEBpQ",
  UserTweets: "SXVCYB8XHSS25nzIljNtZA",
  UserTweetsAndReplies: "qUpkZU6eN8MbtQb7rC_pYg",
  UserMedia: "VyudDWQnr9vJNw7GasFz2g",
  SearchTimeline: "hyPfJYJ_XAtDYoslQc-Rgg",
  TweetDetail: "XMOz5h24KAZ86qKffKTLdQ"
};

const FEATURES: Record<string, boolean> = {
  articles_preview_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  content_disclosure_indicator_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  post_ctas_fetch_enabled: false,
  premium_content_api_read_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_birdwatch_enforce_author_user_quotas: true,
  responsive_web_birdwatch_fast_notes_badge_enabled: false,
  responsive_web_birdwatch_live_note_enabled: true,
  responsive_web_birdwatch_media_notes_enabled: true,
  responsive_web_birdwatch_note_internal_insights_enabled: false,
  responsive_web_birdwatch_note_limit_enabled: true,
  responsive_web_birdwatch_note_request_download_enabled: true,
  responsive_web_birdwatch_note_request_sources_enabled: true,
  responsive_web_birdwatch_signup_prompt_enabled: true,
  responsive_web_birdwatch_top_contributor_enabled: true,
  responsive_web_birdwatch_translation_enabled: true,
  responsive_web_birdwatch_url_notes_enabled: false,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_grok_community_note_translation_is_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_profile_redirect_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  rweb_cashtags_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  rweb_video_screen_enabled: false,
  spaces_2022_h2_clipping: true,
  spaces_2022_h2_spaces_communities: true,
  standardized_nudges_misinfo: true,
  subscriptions_feature_can_gift_premium: true,
  subscriptions_management_fetch_next_billing_time: true,
  subscriptions_marketing_page_fetch_promotions: true,
  subscriptions_upsells_api_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
  view_counts_everywhere_api_enabled: true
};

let guestToken: { value: string; expiresAt: number } | null = null;
let queryIdsRefreshedAt = 0;

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
  timeoutMs = 8_000
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
    throw new Error("Xのゲストセッションを開始できませんでした");
  }
  const payload = (await response.json()) as { guest_token?: string };
  if (!payload.guest_token) {
    throw new Error("Xのゲストトークン取得結果が不正です");
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
    Accept: "*/*"
  };
}

async function discoverCurrentQueryIds(): Promise<void> {
  if (Date.now() - queryIdsRefreshedAt < 5 * 60_000) return;
  queryIdsRefreshedAt = Date.now();

  const entryUrls = [
    "https://x.com/home",
    "https://x.com/i/flow/login",
    "https://twitter.com/home"
  ];
  let mainUrl = "";
  for (const url of entryUrls) {
    try {
      const response = await fetchTimeout(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        redirect: "follow"
      });
      if (!response.ok) continue;
      const html = await response.text();
      const match = html.match(
        /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/main\.([a-z0-9]+)\.js/i
      );
      if (match) {
        mainUrl = match[0];
        break;
      }
    } catch {
      // Try the next public entry page.
    }
  }
  if (!mainUrl) return;

  try {
    const response = await fetchTimeout(mainUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" }
    }, 12_000);
    if (!response.ok) return;
    const source = await response.text();
    const operationPattern =
      /queryId:"([A-Za-z0-9_-]+)",operationName:"([A-Za-z0-9_]+)",operationType:"(query|mutation|subscription)"/g;
    for (const match of source.matchAll(operationPattern)) {
      const operationName = match[2]!;
      if (operationName in OPERATION_IDS) {
        OPERATION_IDS[operationName] = match[1]!;
      }
    }
  } catch {
    // Keep the last known-good IDs.
  }
}

async function graphqlRequest(
  operationName:
    | "UserByScreenName"
    | "UserTweets"
    | "UserTweetsAndReplies"
    | "UserMedia"
    | "SearchTimeline"
    | "TweetDetail",
  variables: Record<string, unknown>,
  retried = false
): Promise<any> {
  const queryId = OPERATION_IDS[operationName]!;
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
    response = await fetchTimeout(url, { headers });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const staleId =
      response.status === 404 ||
      (response.status === 400 &&
        /query|persisted|operation/i.test(detail));
    if (!retried && staleId) {
      queryIdsRefreshedAt = 0;
      await discoverCurrentQueryIds();
      return graphqlRequest(operationName, variables, true);
    }
    if (response.status === 429) {
      throw new Error("X側のレート制限中です");
    }
    throw new Error(
      "X API " + response.status + ": " + detail.slice(0, 160)
    );
  }

  const payload = await response.json();
  if (!retried && payload && typeof payload === "object" && "errors" in payload) {
    const errorText = JSON.stringify((payload as any).errors ?? "");
    if (/query|persisted|operation/i.test(errorText)) {
      queryIdsRefreshedAt = 0;
      await discoverCurrentQueryIds();
      return graphqlRequest(operationName, variables, true);
    }
  }
  return payload;
}

type SearchTweet = {
  id: string;
  username: string | null;
  parentId: string | null;
  conversationId: string | null;
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
    tweet?.author?.legacy?.screen_name ??
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
    conversationId: legacy.conversation_id_str
      ? String(legacy.conversation_id_str)
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

async function searchTweets(
  rawQuery: string,
  product: "Latest" | "Top" | "People" = "Latest"
): Promise<SearchTweet[]> {
  const payload = await graphqlRequest("SearchTimeline", {
    rawQuery,
    count: 20,
    querySource: "typed_query",
    product
  });
  return collectTweetResults(payload);
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
      throw new Error("Xアカウントが見つからないか、公開情報を取得できません");
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
  return {
    userId: user.rest_id ? String(user.rest_id) : null,
    displayName: String(legacy.name ?? username),
    protected: Boolean(legacy.protected),
    suspended: false,
    tweetCount:
      Number.isFinite(Number(legacy.statuses_count))
        ? Number(legacy.statuses_count)
        : null
  };
}

async function userTimeline(
  operationName: "UserTweets" | "UserTweetsAndReplies" | "UserMedia",
  userId: string
): Promise<SearchTweet[]> {
  const variables: Record<string, unknown> = {
    userId,
    count: 20,
    includePromotedContent: false,
    withVoice: true,
    withV2Timeline: true
  };
  if (operationName === "UserTweets") {
    variables.withQuickPromoteEligibilityTweetFields = true;
  }
  if (operationName === "UserTweetsAndReplies") {
    variables.withCommunity = true;
  }
  if (operationName === "UserMedia") {
    variables.withClientEventToken = false;
    variables.withBirdwatchNotes = false;
  }
  const payload = await graphqlRequest(operationName, variables);
  return collectTweetResults(payload);
}

async function searchSuggestionVisible(username: string): Promise<boolean> {
  const endpoints = [
    "https://x.com/i/api/1.1/search/typeahead.json",
    "https://api.x.com/1.1/search/typeahead.json"
  ];
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("q", "@" + username);
      url.searchParams.set("src", "search_box");
      url.searchParams.set("result_type", "events,users,topics,lists");
      url.searchParams.set("include_ext_is_blue_verified", "1");
      const response = await fetchTimeout(url, { headers: await xHeaders() });
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
    includePromotedContent: false,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true
  };
  if (cursor) variables.cursor = cursor;
  return graphqlRequest("TweetDetail", variables);
}

function sameUser(tweet: SearchTweet, username: string): boolean {
  return (
    typeof tweet.username === "string" &&
    tweet.username.toLowerCase() === username.toLowerCase()
  );
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

export async function checkShadowban(input: string): Promise<ShadowbanResult> {
  const username = cleanUsername(input);
  await discoverCurrentQueryIds().catch(() => undefined);
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

  let profileTweets: SearchTweet[] | null = null;
  if (profile.userId) {
    try {
      profileTweets = (await userTimeline(
        "UserTweets",
        profile.userId
      )).filter((tweet) => sameUser(tweet, username));
    } catch {
      profileTweets = null;
    }
  }

  let latest: SearchTweet[] | null = null;
  try {
    latest = (await searchTweets("from:" + username, "Latest")).filter((tweet) =>
      sameUser(tweet, username)
    );
    if (latest.length > 0) {
      checks.searchBan = clear("最新検索で本人のポストを確認できました");
    } else if (profileTweets && profileTweets.length > 0) {
      checks.searchBan = banned(
        "プロフィールには最近の公開ポストがありますが、最新検索で確認できませんでした"
      );
    } else if ((profile.tweetCount ?? 0) === 0) {
      checks.searchBan = na("公開ポストがないため判定対象がありません");
    } else {
      checks.searchBan = unknown(
        "投稿数はありますが、比較できる最近の公開ポストを取得できませんでした"
      );
    }
  } catch (error) {
    checks.searchBan = unknown(
      "検索結果を取得できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  try {
    const visible = await searchSuggestionVisible(username);
    checks.searchSuggestionBan = visible
      ? clear("検索候補にアカウントを確認できました")
      : banned("検索候補にアカウントを確認できませんでした");
  } catch (error) {
    checks.searchSuggestionBan = unknown(
      "検索候補を取得できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  try {
    const base = latest ?? (await searchTweets("from:" + username, "Latest"));
    if (base.length > 0) {
      const safe = (await searchTweets(
        "from:" + username + " filter:safe",
        "Latest"
      )).filter((tweet) => sameUser(tweet, username));
      checks.searchSensitiveBan =
        safe.length > 0
          ? clear("セーフ検索でも本人のポストを確認できました")
          : banned("通常検索では表示されますがセーフ検索では確認できません");
    } else if ((profile.tweetCount ?? 0) === 0) {
      checks.searchSensitiveBan = na("公開ポストがないため判定対象がありません");
    } else {
      const sensitivity =
        profileTweets?.find((tweet) => tweet.possiblySensitive !== null)
          ?.possiblySensitive ?? null;
      checks.searchSensitiveBan =
        sensitivity === true
          ? banned("最近の公開ポストにセンシティブ判定を確認しました")
          : sensitivity === false
            ? clear("最近の公開ポストにセンシティブ判定は確認されませんでした")
            : unknown(
                "Search Ban等によりセーフ検索との比較ができず、センシティブ判定情報も取得できません"
              );
    }
  } catch (error) {
    checks.searchSensitiveBan = unknown(
      "セーフ検索を比較できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  try {
    if (!profile.userId) {
      checks.mediaBan = unknown("プロフィールのユーザーIDを取得できません");
    } else {
      const profileMedia = (await userTimeline(
        "UserMedia",
        profile.userId
      )).filter((tweet) => sameUser(tweet, username));
      if (profileMedia.length === 0) {
        checks.mediaBan = na("判定に使える最近のメディア投稿がありません");
      } else {
        const topMedia = (await searchTweets(
          "from:" + username + " filter:media",
          "Top"
        )).filter((tweet) => sameUser(tweet, username));
        checks.mediaBan =
          topMedia.length > 0
            ? clear("メディア投稿を検索のTopでも確認できました")
            : banned(
                "プロフィールにはメディア投稿がありますが、メディア検索のTopで確認できません"
              );
      }
    }
  } catch (error) {
    checks.mediaBan = unknown(
      "メディア検索を比較できません: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  try {
    let replyCandidates: SearchTweet[] = [];
    if (profile.userId) {
      try {
        replyCandidates = (await userTimeline(
          "UserTweetsAndReplies",
          profile.userId
        ))
          .filter((tweet) => sameUser(tweet, username))
          .filter((tweet) => Boolean(tweet.parentId));
      } catch {
        replyCandidates = [];
      }
    }
    if (replyCandidates.length === 0) {
      replyCandidates = (await searchTweets(
        "from:" + username + " filter:replies",
        "Latest"
      ))
        .filter((tweet) => sameUser(tweet, username))
        .filter((tweet) => Boolean(tweet.parentId));
    }

    const target = replyCandidates[0];
    if (!target?.parentId) {
      checks.ghostBan = na("判定に使える最近の返信がありません");
      checks.replyDeboosting = na("判定に使える最近の返信がありません");
    } else {
      const first = await tweetDetail(target.parentId);
      const initialIds = new Set(collectTweetResults(first).map((tweet) => tweet.id));
      if (initialIds.has(target.id)) {
        checks.ghostBan = clear("返信スレッドで対象リプライを確認できました");
        checks.replyDeboosting = clear("対象リプライは初期表示範囲で確認できました");
      } else {
        const cursors = collectShowMoreCursors(first).slice(0, 2);
        let foundInShowMore = false;
        for (const cursor of cursors) {
          try {
            const page = await tweetDetail(target.parentId, cursor);
            const ids = new Set(
              collectTweetResults(page).map((tweet) => tweet.id)
            );
            if (ids.has(target.id)) {
              foundInShowMore = true;
              break;
            }
          } catch {
            // Continue with another show-more cursor.
          }
        }

        if (foundInShowMore) {
          checks.ghostBan = clear("追加返信を開くと対象リプライを確認できました");
          checks.replyDeboosting = banned(
            "対象リプライが初期表示から外れ、追加返信側で確認されました"
          );
        } else if (cursors.length > 0) {
          checks.ghostBan = banned(
            "返信検索では存在しますが対象スレッド内で確認できませんでした"
          );
          checks.replyDeboosting = unknown(
            "対象返信をスレッドで確認できないため降格だけを分離判定できません"
          );
        } else {
          checks.ghostBan = unknown(
            "対象返信を初期スレッドで確認できず、追加返信カーソルもありません"
          );
          checks.replyDeboosting = unknown(
            "返信表示順位を判定する材料が不足しています"
          );
        }
      }
    }
  } catch (error) {
    const detail =
      "返信スレッドを確認できません: " +
      (error instanceof Error ? error.message : String(error));
    checks.ghostBan = unknown(detail);
    checks.replyDeboosting = unknown(detail);
  }

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
