package postgres

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"

	chatapp "github.com/araik/codex-webrtc/project/backend/internal/chat/application"
	"github.com/araik/codex-webrtc/project/backend/internal/chat/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func Open(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return NewStore(pool), nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	sql, err := migrationFiles.ReadFile("migrations/001_chat_schema.up.sql")
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, string(sql))
	return err
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) CreateSpace(ctx context.Context, id, title string) (domain.Space, error) {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		insert into chat_spaces(id, title, created_at)
		values ($1, $2, $3)
		on conflict (id) do update set title = excluded.title
	`, id, title, now)
	if err != nil {
		return domain.Space{}, err
	}
	return domain.Space{ID: id, Title: title, CreatedAt: now}, nil
}

func (s *Store) DeleteSpace(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `update chat_spaces set deleted_at = now() where id = $1 and deleted_at is null`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return chatapp.ErrNotFound
	}
	return nil
}

func (s *Store) CreateChannel(ctx context.Context, spaceID, channelID, title, kind string) (domain.Channel, error) {
	if kind == "" {
		kind = "text"
	}
	now := time.Now().UTC()
	row := s.pool.QueryRow(ctx, `
		insert into chat_channels(id, space_id, title, kind, created_at)
		values ($1, $2, $3, $4, $5)
		on conflict (id) do update set title = excluded.title
		returning id, space_id, title, kind, created_at
	`, channelID, spaceID, title, kind, now)
	return scanChannel(row)
}

func (s *Store) CreateSession(ctx context.Context, channelID string, participant domain.Participant) (domain.Channel, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Channel{}, err
	}
	defer rollback(ctx, tx)

	row := tx.QueryRow(ctx, `select id, space_id, title, kind, created_at from chat_channels where id = $1 and deleted_at is null`, channelID)
	channel, err := scanChannel(row)
	if err != nil {
		return domain.Channel{}, mapNoRows(err)
	}
	_, err = tx.Exec(ctx, `
		insert into chat_channel_members(channel_id, participant_id, display_name, role, joined_at)
		values ($1, $2, $3, $4, now())
		on conflict (channel_id, participant_id)
		do update set display_name = excluded.display_name, role = excluded.role
	`, channelID, participant.ID, participant.DisplayName, string(participant.Role))
	if err != nil {
		return domain.Channel{}, err
	}
	return channel, tx.Commit(ctx)
}

func (s *Store) Snapshot(ctx context.Context, claims chatapp.ChatTokenClaims) (domain.Snapshot, error) {
	channels, err := s.loadChannels(ctx, claims.ChannelIDs)
	if err != nil {
		return domain.Snapshot{}, err
	}
	messages := make([]domain.Message, 0)
	readCursors := make([]domain.ReadCursor, 0)
	unread := map[string]int{}
	for _, channelID := range claims.ChannelIDs {
		channelMessages, err := s.ListMessages(ctx, claims, channelID, 50, "", "")
		if err != nil {
			return domain.Snapshot{}, err
		}
		messages = append(messages, channelMessages...)
		cursor, err := s.loadReadCursor(ctx, channelID, claims.ParticipantID)
		if err == nil {
			readCursors = append(readCursors, cursor)
			unread[channelID] = unreadAfter(channelMessages, cursor.LastReadMessageID, claims.ParticipantID)
		} else {
			unread[channelID] = unreadAfter(channelMessages, "", claims.ParticipantID)
		}
	}
	return domain.Snapshot{
		SpaceID:         claims.SpaceID,
		Participant:     domain.Participant{ID: claims.ParticipantID, DisplayName: claims.DisplayName, Role: domain.ParticipantRole(claims.Role)},
		Channels:        channels,
		Messages:        messages,
		ReadCursors:     readCursors,
		UnreadByChannel: unread,
	}, nil
}

func (s *Store) ListMessages(ctx context.Context, claims chatapp.ChatTokenClaims, channelID string, limit int, before, after string) ([]domain.Message, error) {
	if !allowedChannel(claims, channelID) {
		return nil, chatapp.ErrForbidden
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	where := `where m.channel_id = $1`
	args := []any{channelID}
	if before != "" {
		where += ` and m.created_at < (select created_at from chat_messages where id = $2)`
		args = append(args, before)
	} else if after != "" {
		where += ` and m.created_at > (select created_at from chat_messages where id = $2)`
		args = append(args, after)
	}
	args = append(args, limit)
	rows, err := s.pool.Query(ctx, `
		select m.id, m.channel_id, m.author_id, m.author_name, m.author_role, m.body_markdown, m.body_plain,
		       m.mentions, coalesce(m.reply_to_id, ''), m.created_at, m.edited_at, m.deleted_at
		from chat_messages m `+where+`
		order by m.created_at desc, m.id desc
		limit $`+itoa(len(args))+`
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages, err := scanMessages(rows)
	if err != nil {
		return nil, err
	}
	reverse(messages)
	return s.hydrateMessages(ctx, messages)
}

func (s *Store) SendMessage(ctx context.Context, claims chatapp.ChatTokenClaims, channelID, markdown, replyToID string, attachments []domain.Attachment, idempotencyKey string) (domain.Message, error) {
	if !allowedChannel(claims, channelID) {
		return domain.Message{}, chatapp.ErrForbidden
	}
	body := strings.TrimSpace(markdown)
	if body == "" && len(attachments) == 0 {
		return domain.Message{}, chatapp.ErrInvalidBody
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Message{}, err
	}
	defer rollback(ctx, tx)
	if existing, ok, err := getIdempotentMessage(ctx, tx, "send:"+channelID+":"+claims.ParticipantID, idempotencyKey); ok || err != nil {
		if err != nil {
			return domain.Message{}, err
		}
		return s.getMessage(ctx, existing)
	}
	var spaceID string
	if err := tx.QueryRow(ctx, `select space_id from chat_channels where id = $1 and deleted_at is null`, channelID).Scan(&spaceID); err != nil {
		return domain.Message{}, mapNoRows(err)
	}
	now := time.Now().UTC()
	message := domain.Message{
		ID:           "msg_" + uuid.NewString(),
		ChannelID:    channelID,
		Author:       domain.Participant{ID: claims.ParticipantID, DisplayName: claims.DisplayName, Role: domain.ParticipantRole(claims.Role)},
		BodyMarkdown: body,
		BodyPlain:    plainText(body),
		Mentions:     extractMentions(body),
		ReplyToID:    replyToID,
		LinkPreviews: extractLinkPreviews(body),
		Reactions:    map[string][]string{},
		CreatedAt:    now,
	}
	mentions, _ := json.Marshal(message.Mentions)
	_, err = tx.Exec(ctx, `
		insert into chat_messages(id, channel_id, author_id, author_name, author_role, body_markdown, body_plain, mentions, reply_to_id, created_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, message.ID, channelID, claims.ParticipantID, claims.DisplayName, claims.Role, message.BodyMarkdown, message.BodyPlain, mentions, nullableString(replyToID), now)
	if err != nil {
		return domain.Message{}, err
	}
	for _, attachment := range attachments {
		_, err = tx.Exec(ctx, `update chat_attachments set message_id = $1, updated_at = now() where id = $2 and owner_id = $3`, message.ID, attachment.ID, claims.ParticipantID)
		if err != nil {
			return domain.Message{}, err
		}
	}
	for _, preview := range message.LinkPreviews {
		_, err = tx.Exec(ctx, `
			insert into chat_link_previews(id, message_id, url, status, updated_at)
			values ($1, $2, $3, $4, now())
		`, "link_"+uuid.NewString(), message.ID, preview.URL, preview.Status)
		if err != nil {
			return domain.Message{}, err
		}
	}
	if err := rememberIdempotentMessage(ctx, tx, "send:"+channelID+":"+claims.ParticipantID, idempotencyKey, message.ID); err != nil {
		return domain.Message{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Message{}, err
	}
	return s.getMessage(ctx, message.ID)
}

func (s *Store) EditMessage(ctx context.Context, claims chatapp.ChatTokenClaims, messageID, markdown, _ string) (domain.Message, error) {
	body := strings.TrimSpace(markdown)
	if body == "" {
		return domain.Message{}, chatapp.ErrInvalidBody
	}
	mentions, _ := json.Marshal(extractMentions(body))
	tag, err := s.pool.Exec(ctx, `
		update chat_messages
		set body_markdown = $1, body_plain = $2, mentions = $3, edited_at = now()
		where id = $4 and author_id = $5 and deleted_at is null
	`, body, plainText(body), mentions, messageID, claims.ParticipantID)
	if err != nil {
		return domain.Message{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.Message{}, chatapp.ErrForbidden
	}
	_, _ = s.pool.Exec(ctx, `delete from chat_link_previews where message_id = $1`, messageID)
	for _, preview := range extractLinkPreviews(body) {
		_, err = s.pool.Exec(ctx, `insert into chat_link_previews(id, message_id, url, status, updated_at) values ($1,$2,$3,$4,now())`, "link_"+uuid.NewString(), messageID, preview.URL, preview.Status)
		if err != nil {
			return domain.Message{}, err
		}
	}
	return s.getMessage(ctx, messageID)
}

func (s *Store) DeleteMessage(ctx context.Context, claims chatapp.ChatTokenClaims, messageID, _ string) (domain.Message, error) {
	tag, err := s.pool.Exec(ctx, `
		update chat_messages
		set body_markdown = '', body_plain = '', deleted_at = now()
		where id = $1 and author_id = $2 and deleted_at is null
	`, messageID, claims.ParticipantID)
	if err != nil {
		return domain.Message{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.Message{}, chatapp.ErrForbidden
	}
	_, _ = s.pool.Exec(ctx, `delete from chat_message_reactions where message_id = $1`, messageID)
	return s.getMessage(ctx, messageID)
}

func (s *Store) ToggleReaction(ctx context.Context, claims chatapp.ChatTokenClaims, messageID, emoji, _ string) (domain.Message, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from chat_message_reactions where message_id = $1 and emoji = $2 and participant_id = $3)`, messageID, emoji, claims.ParticipantID).Scan(&exists)
	if err != nil {
		return domain.Message{}, err
	}
	if exists {
		_, err = s.pool.Exec(ctx, `delete from chat_message_reactions where message_id = $1 and emoji = $2 and participant_id = $3`, messageID, emoji, claims.ParticipantID)
	} else {
		_, err = s.pool.Exec(ctx, `insert into chat_message_reactions(message_id, emoji, participant_id, created_at) values ($1,$2,$3,now())`, messageID, emoji, claims.ParticipantID)
	}
	if err != nil {
		return domain.Message{}, err
	}
	return s.getMessage(ctx, messageID)
}

func (s *Store) MarkRead(ctx context.Context, claims chatapp.ChatTokenClaims, channelID, messageID, _ string) (domain.ReadCursor, error) {
	if !allowedChannel(claims, channelID) {
		return domain.ReadCursor{}, chatapp.ErrForbidden
	}
	cursor := domain.ReadCursor{ChannelID: channelID, ParticipantID: claims.ParticipantID, LastReadMessageID: messageID, UpdatedAt: time.Now().UTC()}
	_, err := s.pool.Exec(ctx, `
		insert into chat_read_cursors(channel_id, participant_id, last_read_message_id, updated_at)
		values ($1,$2,$3,$4)
		on conflict (channel_id, participant_id)
		do update set last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at
	`, cursor.ChannelID, cursor.ParticipantID, cursor.LastReadMessageID, cursor.UpdatedAt)
	return cursor, err
}

func (s *Store) CreateAttachmentUpload(ctx context.Context, claims chatapp.ChatTokenClaims, fileName, contentType string, sizeBytes int64, id, objectKey, url, _ string) (domain.Attachment, error) {
	if sizeBytes > chatapp.MaxAttachmentSizeBytes {
		return domain.Attachment{}, chatapp.ErrFileTooLarge
	}
	kind := attachmentKind(contentType)
	now := time.Now().UTC()
	attachment := domain.Attachment{ID: id, FileName: fileName, ContentType: contentType, SizeBytes: sizeBytes, Kind: kind, ObjectKey: objectKey, URL: url, Status: "uploading"}
	_, err := s.pool.Exec(ctx, `
		insert into chat_attachments(id, owner_id, file_name, content_type, size_bytes, kind, object_key, original_url, status, created_at, updated_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
	`, id, claims.ParticipantID, fileName, contentType, sizeBytes, kind, objectKey, url, attachment.Status, now)
	return attachment, err
}

func (s *Store) CompleteAttachment(ctx context.Context, claims chatapp.ChatTokenClaims, attachmentID, _ string) (domain.Attachment, error) {
	tag, err := s.pool.Exec(ctx, `update chat_attachments set status = 'uploaded', updated_at = now() where id = $1 and owner_id = $2`, attachmentID, claims.ParticipantID)
	if err != nil {
		return domain.Attachment{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.Attachment{}, chatapp.ErrNotFound
	}
	return s.GetAttachment(ctx, claims, attachmentID)
}

func (s *Store) GetAttachment(ctx context.Context, _ chatapp.ChatTokenClaims, attachmentID string) (domain.Attachment, error) {
	rows, err := s.pool.Query(ctx, `
		select id, coalesce(message_id,''), owner_id, file_name, content_type, size_bytes, kind, object_key, original_url,
		       coalesce(preview_url,''), coalesce(poster_url,''), coalesce(width,0), coalesce(height,0), coalesce(duration_ms,0), status
		from chat_attachments where id = $1
	`, attachmentID)
	if err != nil {
		return domain.Attachment{}, err
	}
	defer rows.Close()
	attachments, err := scanAttachments(rows)
	if err != nil {
		return domain.Attachment{}, err
	}
	if len(attachments) == 0 {
		return domain.Attachment{}, chatapp.ErrNotFound
	}
	return attachments[0], nil
}

func (s *Store) getMessage(ctx context.Context, messageID string) (domain.Message, error) {
	rows, err := s.pool.Query(ctx, `
		select id, channel_id, author_id, author_name, author_role, body_markdown, body_plain, mentions, coalesce(reply_to_id, ''), created_at, edited_at, deleted_at
		from chat_messages where id = $1
	`, messageID)
	if err != nil {
		return domain.Message{}, err
	}
	defer rows.Close()
	messages, err := scanMessages(rows)
	if err != nil {
		return domain.Message{}, err
	}
	if len(messages) == 0 {
		return domain.Message{}, chatapp.ErrNotFound
	}
	hydrated, err := s.hydrateMessages(ctx, messages)
	if err != nil {
		return domain.Message{}, err
	}
	return hydrated[0], nil
}

func (s *Store) hydrateMessages(ctx context.Context, messages []domain.Message) ([]domain.Message, error) {
	for index := range messages {
		reactions, err := s.loadReactions(ctx, messages[index].ID)
		if err != nil {
			return nil, err
		}
		attachments, err := s.loadAttachments(ctx, messages[index].ID)
		if err != nil {
			return nil, err
		}
		previews, err := s.loadLinkPreviews(ctx, messages[index].ID)
		if err != nil {
			return nil, err
		}
		messages[index].Reactions = reactions
		messages[index].Attachments = attachments
		messages[index].LinkPreviews = previews
	}
	return messages, nil
}

func (s *Store) loadChannels(ctx context.Context, channelIDs []string) ([]domain.Channel, error) {
	channels := make([]domain.Channel, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		channel, err := scanChannel(s.pool.QueryRow(ctx, `select id, space_id, title, kind, created_at from chat_channels where id = $1 and deleted_at is null`, channelID))
		if err == nil {
			channels = append(channels, channel)
		}
	}
	return channels, nil
}

func (s *Store) loadReadCursor(ctx context.Context, channelID, participantID string) (domain.ReadCursor, error) {
	var cursor domain.ReadCursor
	err := s.pool.QueryRow(ctx, `select channel_id, participant_id, last_read_message_id, updated_at from chat_read_cursors where channel_id = $1 and participant_id = $2`, channelID, participantID).
		Scan(&cursor.ChannelID, &cursor.ParticipantID, &cursor.LastReadMessageID, &cursor.UpdatedAt)
	return cursor, err
}

func (s *Store) loadReactions(ctx context.Context, messageID string) (map[string][]string, error) {
	rows, err := s.pool.Query(ctx, `select emoji, participant_id from chat_message_reactions where message_id = $1 order by created_at`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reactions := map[string][]string{}
	for rows.Next() {
		var emoji, participantID string
		if err := rows.Scan(&emoji, &participantID); err != nil {
			return nil, err
		}
		reactions[emoji] = append(reactions[emoji], participantID)
	}
	return reactions, rows.Err()
}

func (s *Store) loadAttachments(ctx context.Context, messageID string) ([]domain.Attachment, error) {
	rows, err := s.pool.Query(ctx, `
		select id, coalesce(message_id,''), owner_id, file_name, content_type, size_bytes, kind, object_key, original_url,
		       coalesce(preview_url,''), coalesce(poster_url,''), coalesce(width,0), coalesce(height,0), coalesce(duration_ms,0), status
		from chat_attachments where message_id = $1 order by created_at
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAttachments(rows)
}

func (s *Store) loadLinkPreviews(ctx context.Context, messageID string) ([]domain.LinkPreview, error) {
	rows, err := s.pool.Query(ctx, `select url, coalesce(title,''), coalesce(description,''), coalesce(image_url,''), coalesce(site_name,''), status from chat_link_previews where message_id = $1`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	previews := []domain.LinkPreview{}
	for rows.Next() {
		var preview domain.LinkPreview
		if err := rows.Scan(&preview.URL, &preview.Title, &preview.Description, &preview.ImageURL, &preview.SiteName, &preview.Status); err != nil {
			return nil, err
		}
		previews = append(previews, preview)
	}
	return previews, rows.Err()
}

func scanChannel(row pgx.Row) (domain.Channel, error) {
	var channel domain.Channel
	err := row.Scan(&channel.ID, &channel.SpaceID, &channel.Title, &channel.Kind, &channel.CreatedAt)
	return channel, mapNoRows(err)
}

func scanMessages(rows pgx.Rows) ([]domain.Message, error) {
	messages := []domain.Message{}
	for rows.Next() {
		var message domain.Message
		var mentions []byte
		if err := rows.Scan(&message.ID, &message.ChannelID, &message.Author.ID, &message.Author.DisplayName, &message.Author.Role, &message.BodyMarkdown, &message.BodyPlain, &mentions, &message.ReplyToID, &message.CreatedAt, &message.EditedAt, &message.DeletedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(mentions, &message.Mentions)
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func scanAttachments(rows pgx.Rows) ([]domain.Attachment, error) {
	attachments := []domain.Attachment{}
	for rows.Next() {
		var attachment domain.Attachment
		var messageID, ownerID string
		if err := rows.Scan(&attachment.ID, &messageID, &ownerID, &attachment.FileName, &attachment.ContentType, &attachment.SizeBytes, &attachment.Kind, &attachment.ObjectKey, &attachment.URL, &attachment.PreviewURL, &attachment.PosterURL, &attachment.Width, &attachment.Height, &attachment.DurationMs, &attachment.Status); err != nil {
			return nil, err
		}
		attachments = append(attachments, attachment)
	}
	return attachments, rows.Err()
}

func getIdempotentMessage(ctx context.Context, tx pgx.Tx, scope, key string) (string, bool, error) {
	if key == "" {
		return "", false, nil
	}
	var id string
	err := tx.QueryRow(ctx, `select result_id from chat_idempotency_keys where scope = $1 and key = $2`, scope, key).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return id, err == nil, err
}

func rememberIdempotentMessage(ctx context.Context, tx pgx.Tx, scope, key, resultID string) error {
	if key == "" {
		return nil
	}
	_, err := tx.Exec(ctx, `insert into chat_idempotency_keys(scope, key, result_id, created_at) values ($1,$2,$3,now()) on conflict do nothing`, scope, key, resultID)
	return err
}

func mapNoRows(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return chatapp.ErrNotFound
	}
	return err
}

func rollback(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}

func allowedChannel(claims chatapp.ChatTokenClaims, channelID string) bool {
	for _, id := range claims.ChannelIDs {
		if id == channelID {
			return true
		}
	}
	return false
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func attachmentKind(contentType string) string {
	switch {
	case strings.HasPrefix(contentType, "image/"):
		return "image"
	case strings.HasPrefix(contentType, "video/"):
		return "video"
	default:
		return "file"
	}
}

func unreadAfter(messages []domain.Message, lastReadMessageID, participantID string) int {
	count := 0
	seenCursor := lastReadMessageID == ""
	for _, message := range messages {
		if message.ID == lastReadMessageID {
			seenCursor = true
			count = 0
			continue
		}
		if seenCursor && message.DeletedAt == nil && message.Author.ID != participantID {
			count++
		}
	}
	return count
}

func reverse(messages []domain.Message) {
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

var mentionPattern = regexp.MustCompile(`@([a-zA-Z0-9_.-]+)`)
var linkPattern = regexp.MustCompile(`https?://[^\s<]+`)

func extractMentions(markdown string) []string {
	matches := mentionPattern.FindAllStringSubmatch(markdown, -1)
	result := make([]string, 0, len(matches))
	for _, match := range matches {
		result = append(result, match[1])
	}
	return result
}

func extractLinkPreviews(markdown string) []domain.LinkPreview {
	matches := linkPattern.FindAllString(markdown, -1)
	result := make([]domain.LinkPreview, 0, len(matches))
	for _, url := range matches {
		result = append(result, domain.LinkPreview{URL: url, Status: "pending"})
	}
	return result
}

func plainText(markdown string) string {
	text := strings.ReplaceAll(markdown, "`", "")
	text = strings.ReplaceAll(text, "*", "")
	text = strings.ReplaceAll(text, "_", "")
	return strings.TrimSpace(text)
}

func sanitizeFileName(fileName string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", "\x00", "")
	name := strings.TrimSpace(replacer.Replace(fileName))
	if name == "" {
		return "file"
	}
	return name
}

var _ chatapp.Store = (*Store)(nil)
