// test/acceptance_test.js
// Automated verification of SRS Section 6 Acceptance Criteria

import { mockStore } from '../src/lib/mockStore.js';

console.log('====================================================');
console.log('PROMPT GALLERY ADMIN PANEL · SRS ACCEPTANCE SUITE');
console.log('====================================================\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedCount++;
  }
}

// Reset mock state to clean fixture
mockStore.resetState();

// 1. Role Boundaries: Super Admin Permissions
console.log('--- 1. Testing Super Admin Capabilities ---');
const superAdminMember = mockStore.getMemberByUserId('usr-super-admin-01');
assert(superAdminMember && superAdminMember.role === 'super_admin', 'Super admin member exists in directory');

// Super admin can add a team member
const newEditor = mockStore.addMember('usr-test-editor-99', 'testedit@example.com', 'editor');
assert(newEditor && newEditor.role === 'editor', 'Super admin can add team members');

// 2. Role Boundaries: Last Super Admin Protection
console.log('\n--- 2. Testing Last Super Admin Protection ---');
let lastAdminDemoteBlocked = false;
try {
  mockStore.updateMemberRole('usr-super-admin-01', 'editor');
} catch (e) {
  lastAdminDemoteBlocked = e.message.includes('last super_admin');
}
assert(lastAdminDemoteBlocked, 'Demoting the last super_admin is rejected with safety exception');

let lastAdminDeleteBlocked = false;
try {
  mockStore.removeMember('usr-super-admin-01');
} catch (e) {
  lastAdminDeleteBlocked = e.message.includes('last super_admin');
}
assert(lastAdminDeleteBlocked, 'Deleting the last super_admin is rejected with safety exception');

// 3. Role Boundaries: Publisher Team Denial & Publishing Permissions
console.log('\n--- 3. Testing Publisher Capabilities & Team Denial ---');
const publisher = mockStore.getMemberByUserId('usr-publisher-02');
assert(publisher && publisher.role === 'publisher', 'Publisher role exists');

// Publisher can save live prompt
const newPromptByPub = mockStore.savePrompt({
  title: 'Cyberpunk Neon Dragon',
  slug: 'cyberpunk-neon-dragon',
  prompt_text: 'Majestic neon dragon flying over futuristic Tokyo rooftops, rain reflections, 8k --ar 16:9',
  media_type: 'image',
  status: 'draft',
}, { id: publisher.user_id });

assert(newPromptByPub && newPromptByPub.id, 'Publisher can create drafts');

// Attach media to new prompt
const addedMedia = mockStore.addMedia(newPromptByPub.id, {
  storage_path: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
  byte_size: 450000,
  sort_order: 1,
});

// Publisher can publish
const publishedPrompt = mockStore.savePrompt({
  id: newPromptByPub.id,
  title: newPromptByPub.title,
  slug: newPromptByPub.slug,
  prompt_text: newPromptByPub.prompt_text,
  media_type: 'image',
  status: 'published',
  cover_media_id: addedMedia.id,
}, { id: publisher.user_id });

assert(publishedPrompt.status === 'published' && publishedPrompt.published_at !== null, 'Publisher can publish prompt');
const firstPublishDate = publishedPrompt.published_at;

// 4. First-Publish Date Preservation
console.log('\n--- 4. Testing First-Publish Date Preservation on Live Update ---');
const updatedLivePrompt = mockStore.savePrompt({
  id: newPromptByPub.id,
  title: 'Cyberpunk Neon Dragon (Updated Title)',
  slug: newPromptByPub.slug,
  prompt_text: newPromptByPub.prompt_text,
  media_type: 'image',
  status: 'published',
  cover_media_id: addedMedia.id,
}, { id: publisher.user_id });

assert(updatedLivePrompt.published_at === firstPublishDate, 'First published_at timestamp is preserved on live edit');

// 5. Block Removing Last Cover from Published Prompt
console.log('\n--- 5. Testing Published Prompt Cover Integrity ---');
let coverRemovalBlocked = false;
try {
  mockStore.deleteMedia(newPromptByPub.id, addedMedia.id);
} catch (e) {
  coverRemovalBlocked = e.message.includes('last valid cover');
}
assert(coverRemovalBlocked, 'Removing the last valid cover from a published prompt is blocked');

// 6. In-Use Tag Deletion Protection
console.log('\n--- 6. Testing In-Use Tag Deletion Block ---');
// tag-1 ('photorealistic') is used by existing prompts
let tagDeleteBlocked = false;
try {
  mockStore.deleteTag('tag-1');
} catch (e) {
  tagDeleteBlocked = e.message.includes('Cannot delete tag');
}
assert(tagDeleteBlocked, 'Deleting in-use tag is blocked until mappings are removed');

// Unused tag can be deleted
const unusedTag = mockStore.saveTag({ name: 'Temporary Tag', slug: 'temp-tag' });
const tagDeleted = mockStore.deleteTag(unusedTag.id);
assert(tagDeleted === true, 'Unused tag can be safely deleted');

// 7. Seed Collections (Featured and Trending)
console.log('\n--- 7. Testing System Seed Collections ---');
const collections = mockStore.getCollections();
const hasFeatured = collections.some(c => c.slug === 'featured');
const hasTrending = collections.some(c => c.slug === 'trending');
assert(hasFeatured && hasTrending, 'Featured and Trending seed collections exist');

// 8. Video Prompt Publish Validation
console.log('\n--- 8. Testing Video Publishing Validation ---');
let invalidVideoPublishBlocked = false;
try {
  const vidPrompt = mockStore.savePrompt({
    title: 'Cinematic Drone Flyover',
    slug: 'cinematic-drone-flyover',
    prompt_text: 'Drone flyover mountain ridge',
    media_type: 'video',
    status: 'draft',
  }, { id: superAdminMember.user_id });

  // Add media missing duration
  const vidMedia = mockStore.addMedia(vidPrompt.id, {
    storage_path: 'https://example.com/video.mp4',
    byte_size: 15000000,
    duration_ms: null, // missing duration!
  });

  mockStore.savePrompt({
    id: vidPrompt.id,
    title: vidPrompt.title,
    slug: vidPrompt.slug,
    prompt_text: vidPrompt.prompt_text,
    media_type: 'video',
    status: 'published',
    cover_media_id: vidMedia.id,
  }, { id: superAdminMember.user_id });
} catch (e) {
  invalidVideoPublishBlocked = e.message.includes('duration');
}
assert(invalidVideoPublishBlocked, 'Publishing video prompt without positive duration is rejected');

// 9. Concurrency Conflict (updated_at optimistic check)
console.log('\n--- 9. Testing Optimistic Concurrency Check ---');
let conflictDetected = false;
try {
  mockStore.savePrompt({
    id: 'prm-001',
    title: 'Stale update attempt',
    slug: 'ethereal-cyberpunk-metropolis',
    prompt_text: 'test',
    media_type: 'image',
    original_updated_at: '2020-01-01T00:00:00Z', // stale date!
  }, { id: superAdminMember.user_id });
} catch (e) {
  conflictDetected = e.message.includes('Concurrency Conflict');
}
assert(conflictDetected, 'Out-of-date edit attempt triggers Concurrency Conflict warning');

// 10. ImageKit and External Image Handling
console.log('\n--- 10. Testing ImageKit & External URL Input Options ---');
import('../src/lib/imagekit.js').then(({ validateImageFile, validateImageUrl, getImageVariant, IMAGE_LIMITS }) => {
  // Test Image Validation Limits
  let validImagePassed = false;
  try {
    validImagePassed = validateImageFile({ type: 'image/png', size: 2 * 1024 * 1024, name: 'sample.png' });
  } catch (e) {
    validImagePassed = false;
  }
  assert(validImagePassed, 'Central image validator accepts standard PNG under 10MB');

  let oversizeImageBlocked = false;
  try {
    validateImageFile({ type: 'image/jpeg', size: 15 * 1024 * 1024, name: 'large.jpg' });
  } catch (e) {
    oversizeImageBlocked = e.message.includes('exceeds maximum');
  }
  assert(oversizeImageBlocked, 'Central image validator rejects files exceeding 10MB limit');

  let invalidMimeBlocked = false;
  try {
    validateImageFile({ type: 'application/pdf', size: 1024, name: 'doc.pdf' });
  } catch (e) {
    invalidMimeBlocked = e.message.includes('Unsupported file format');
  }
  assert(invalidMimeBlocked, 'Central image validator rejects non-image MIME types');

  // Test URL Validation
  let httpsUrlPassed = false;
  try {
    const clean = validateImageUrl('https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format');
    httpsUrlPassed = clean.startsWith('https://');
  } catch (e) {
    httpsUrlPassed = false;
  }
  assert(httpsUrlPassed, 'HTTPS image URL validator accepts extensionless CDN URLs');

  let nonHttpsBlocked = false;
  try {
    validateImageUrl('http://insecure-site.com/image.png');
  } catch (e) {
    nonHttpsBlocked = e.message.includes('secure HTTPS protocol');
  }
  assert(nonHttpsBlocked, 'Image URL validator rejects insecure HTTP URLs');

  // Test Transformations
  const ikUrl = 'https://ik.imagekit.io/promptgallery/prompts/cyberpunk-villa.jpg';
  const thumbUrl = getImageVariant(ikUrl, 'imagekit', 'thumbnail');
  assert(thumbUrl.includes('tr=w-400,h-300'), 'ImageKit thumbnail derives w-400 transform parameters');

  const externalUrl = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675';
  const extVariant = getImageVariant(externalUrl, 'external', 'thumbnail');
  assert(extVariant === externalUrl, 'External third-party URLs are served as-is without ImageKit transforms');

  // 11. Storing ImageKit & External media in store
  console.log('\n--- 11. Testing ImageKit & External Media Metadata Persistence ---');
  const ikMedia = mockStore.addMedia(newPromptByPub.id, {
    source_type: 'imagekit',
    image_url: ikUrl,
    imagekit_file_id: 'ik_file_8829910',
    byte_size: 320000,
    width: 1920,
    height: 1080,
  });
  assert(ikMedia.source_type === 'imagekit' && ikMedia.imagekit_file_id === 'ik_file_8829910', 'ImageKit-managed media stores source_type and imagekit_file_id');

  const extMedia = mockStore.addMedia(newPromptByPub.id, {
    source_type: 'external',
    image_url: externalUrl,
    imagekit_file_id: null,
    byte_size: 0,
  });
  assert(extMedia.source_type === 'external' && extMedia.imagekit_file_id === null, 'External image media stores source_type and null file ID');

  // Category cover with ImageKit and external metadata
  const catWithImageKit = mockStore.saveCategory({
    name: 'Concept Architecture',
    slug: 'concept-architecture',
    cover_image_url: ikUrl,
    cover_source_type: 'imagekit',
    cover_imagekit_file_id: 'ik_cat_cover_123',
  });
  assert(catWithImageKit.cover_image_url === ikUrl && catWithImageKit.cover_source_type === 'imagekit', 'Category persists ImageKit cover metadata');

  // 12. Mobile App Settings Acceptance Checks
  console.log('\n--- 12. Testing Mobile App Settings Module ---');

  // Verify Initial Mobile Settings
  const initialSettings = mockStore.getMobileSettings();
  assert(initialSettings && initialSettings.version === 1, 'Initial mobile settings seeded at v1');

  const initialPublic = mockStore.getPublicMobileSettings();
  assert(initialPublic && initialPublic.version === 1, 'Initial public mobile config returns v1');

  // Check 1: Saving a draft does not affect the mobile app
  const updatedDraft = JSON.parse(JSON.stringify(initialSettings.draft_config));
  updatedDraft.links_support.privacy_policy_url = 'https://promptgallery.app/privacy';
  updatedDraft.links_support.play_store_url = 'https://play.google.com/store/apps/details?id=com.promptgallery';
  updatedDraft.links_support.support_email = 'support@promptgallery.app';
  updatedDraft.home_discover.sections[0].title = 'Curator Picks';

  const savedDraftRes = mockStore.saveMobileSettingsDraft(updatedDraft, 1, 'super_admin');
  assert(savedDraftRes.draft_config.home_discover.sections[0].title === 'Curator Picks', 'Draft config successfully saved');

  const publicAfterDraft = mockStore.getPublicMobileSettings();
  assert(
    publicAfterDraft.config.home_discover.sections[0].title !== 'Curator Picks' &&
    publicAfterDraft.version === 1,
    'Saving draft does NOT affect the public mobile app config or bump version'
  );

  // Check 2: Non-Super Admin accounts cannot write through direct calls
  let publisherWriteBlocked = false;
  try {
    mockStore.saveMobileSettingsDraft(updatedDraft, 1, 'publisher');
  } catch (e) {
    publisherWriteBlocked = e.message.includes('Only Super Admin');
  }
  assert(publisherWriteBlocked, 'Publisher is blocked from saving Mobile App Settings drafts');

  let editorPublishBlocked = false;
  try {
    mockStore.publishMobileSettings(1, 'editor');
  } catch (e) {
    editorPublishBlocked = e.message.includes('Only Super Admin');
  }
  assert(editorPublishBlocked, 'Editor is blocked from publishing Mobile App Settings');

  // Check 3: Concurrency Conflict Protection
  let concurrencyBlocked = false;
  try {
    mockStore.publishMobileSettings(999, 'super_admin'); // wrong expected version
  } catch (e) {
    concurrencyBlocked = e.message.includes('Concurrency conflict');
  }
  assert(concurrencyBlocked, 'Publishing with mismatched expected version is rejected as Concurrency Conflict');

  // Check 4: URL & Email Validation before publishing
  const invalidEmailDraft = JSON.parse(JSON.stringify(updatedDraft));
  invalidEmailDraft.links_support.support_email = 'not-an-email';
  mockStore.saveMobileSettingsDraft(invalidEmailDraft, 1, 'super_admin');

  let invalidEmailBlocked = false;
  try {
    mockStore.publishMobileSettings(1, 'super_admin');
  } catch (e) {
    invalidEmailBlocked = e.message.includes('Invalid support email');
  }
  assert(invalidEmailBlocked, 'Publishing with invalid support email format is rejected');

  // Insecure HTTP URL validation
  const invalidUrlDraft = JSON.parse(JSON.stringify(updatedDraft));
  invalidUrlDraft.links_support.privacy_policy_url = 'http://insecure-privacy.com';
  mockStore.saveMobileSettingsDraft(invalidUrlDraft, 1, 'super_admin');

  let invalidUrlBlocked = false;
  try {
    mockStore.publishMobileSettings(1, 'super_admin');
  } catch (e) {
    invalidUrlBlocked = e.message.includes('HTTPS scheme');
  }
  assert(invalidUrlBlocked, 'Publishing with non-HTTPS privacy policy URL is rejected');

  // Blocking update requires valid Play Store link
  const blockingWithoutStoreDraft = JSON.parse(JSON.stringify(updatedDraft));
  blockingWithoutStoreDraft.links_support.play_store_url = '';
  blockingWithoutStoreDraft.maintenance.update_notice.is_blocking = true;
  mockStore.saveMobileSettingsDraft(blockingWithoutStoreDraft, 1, 'super_admin');

  let blockingUpdateRejected = false;
  try {
    mockStore.publishMobileSettings(1, 'super_admin');
  } catch (e) {
    blockingUpdateRejected = e.message.includes('requires a valid Play Store URL');
  }
  assert(blockingUpdateRejected, 'Enabling a blocking update without Play Store URL is rejected');

  // Check 5: Publishing updates the public config and increments version
  mockStore.saveMobileSettingsDraft(updatedDraft, 1, 'super_admin');
  const publishRes = mockStore.publishMobileSettings(1, 'super_admin');
  assert(publishRes.version === 2, 'Publishing increments settings version to v2');
  assert(publishRes.published_config.home_discover.sections[0].title === 'Curator Picks', 'Published config updated');

  const publicAfterPublish = mockStore.getPublicMobileSettings();
  assert(
    publicAfterPublish.version === 2 &&
    publicAfterPublish.config.home_discover.sections[0].title === 'Curator Picks',
    'Public mobile endpoint immediately reflects published v2 config'
  );

  // Check 6: Share App URL fallback to Play Store URL
  assert(
    publicAfterPublish.config.links_support.share_url === 'https://play.google.com/store/apps/details?id=com.promptgallery',
    'Empty share URL automatically falls back to Play Store URL in public projection'
  );

  // Check 7: Restoring previous published settings
  const restoreRes = mockStore.restoreMobileSettings(2, 'super_admin');
  assert(restoreRes.version === 3, 'Restoring previous snapshot increments version to v3');
  assert(
    restoreRes.published_config.home_discover.sections[0].title === 'Featured Prompts',
    'Restored config reverted title back to initial snapshot'
  );

  const publicAfterRestore = mockStore.getPublicMobileSettings();
  assert(
    publicAfterRestore.version === 3 &&
    publicAfterRestore.config.home_discover.sections[0].title === 'Featured Prompts',
    'Public mobile endpoint serves restored configuration at v3'
  );

  // Check 8: Narrowly scoped public projection sanitization
  assert(publicAfterRestore.draft_config === undefined, 'Public endpoint does not expose draft_config');
  assert(publicAfterRestore.published_by === undefined, 'Public endpoint does not expose internal user IDs');

  console.log('\n====================================================');
  console.log(`TOTAL SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
});

