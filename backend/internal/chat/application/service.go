package application

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/araik/codex-webrtc/project/backend/internal/chat/domain"
	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("chat entity not found")
	ErrForbidden    = errors.New("chat action forbidden")
	ErrInvalidBody  = errors.New("message body is empty")
	ErrFileTooLarge = errors.New("attachment is larger than 100MB")
)

const MaxAttachmentSizeBytes = 100 * 1024 * 1024

type Event struct {
	Type      string
	SpaceID   string
	ChannelID string
	Payload   any
}

type EventSink interface {
	Publish(Event)
}

type Store interface {
	CreateSpace(context.Context, string, string) (domain.Space, error)
	DeleteSpace(context.Context, string) error
	CreateChannel(context.Context, string, string, string, string) (domain.Channel, error)
	CreateSession(context.Context, string, domain.Participant) (domain.Channel, error)
	Snapshot(context.Context, ChatTokenClaims) (domain.Snapshot, error)
	ListMessages(context.Context, ChatTokenClaims, string, int, string, string) ([]domain.Message, error)
	SendMessage(context.Context, ChatTokenClaims, string, string, string, []domain.Attachment, string) (domain.Message, error)
	EditMessage(context.Context, ChatTokenClaims, string, string, string) (domain.Message, error)
	DeleteMessage(context.Context, ChatTokenClaims, string, string) (domain.Message, error)
	ToggleReaction(context.Context, ChatTokenClaims, string, string, string) (domain.Message, error)
	MarkRead(context.Context, ChatTokenClaims, string, string, string) (domain.ReadCursor, error)
	CreateAttachmentUpload(context.Context, ChatTokenClaims, string, string, int64, string, string, string, string) (domain.Attachment, error)
	CompleteAttachment(context.Context, ChatTokenClaims, string, string) (domain.Attachment, error)
	GetAttachment(context.Context, ChatTokenClaims, string) (domain.Attachment, error)
}

type ObjectStorage interface {
	CreateUploadURL(ctx context.Context, objectKey, contentType string, sizeBytes int64) (string, error)
	PublicURL(objectKey string) string
}

type Service struct {
	mu                  sync.RWMutex
	spaces              map[string]domain.Space
	channels            map[string]domain.Channel
	messages            map[string]domain.Message
	messageIDsByChannel map[string][]string
	readCursors         map[string]domain.ReadCursor
	participants        map[string]domain.Participant
	events              EventSink
	store               Store
	objectStorage       ObjectStorage
	clock               Clock
}

func NewService(clock Clock, events EventSink) *Service {
	return &Service{
		spaces:              map[string]domain.Space{},
		channels:            map[string]domain.Channel{},
		messages:            map[string]domain.Message{},
		messageIDsByChannel: map[string][]string{},
		readCursors:         map[string]domain.ReadCursor{},
		participants:        map[string]domain.Participant{},
		events:              events,
		clock:               clock,
	}
}

func NewServiceWithStore(clock Clock, store Store, objectStorage ObjectStorage, events EventSink) *Service {
	service := NewService(clock, events)
	service.store = store
	service.objectStorage = objectStorage
	return service
}

func (s *Service) SetEventSink(events EventSink) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = events
}

func (s *Service) CreateSpace(ctx context.Context, id, title string) (domain.Space, error) {
	if s.store != nil {
		return s.store.CreateSpace(ctx, id, title)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.spaces[id]; ok {
		return existing, nil
	}
	space := domain.Space{ID: id, Title: title, CreatedAt: s.clock.Now()}
	s.spaces[id] = space
	return space, nil
}

func (s *Service) DeleteSpace(ctx context.Context, id string) error {
	if s.store != nil {
		return s.store.DeleteSpace(ctx, id)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.spaces[id]; !ok {
		return ErrNotFound
	}
	delete(s.spaces, id)
	for channelID, channel := range s.channels {
		if channel.SpaceID == id {
			delete(s.channels, channelID)
			delete(s.messageIDsByChannel, channelID)
		}
	}
	return nil
}

func (s *Service) CreateChannel(ctx context.Context, spaceID, channelID, title, kind string) (domain.Channel, error) {
	if s.store != nil {
		return s.store.CreateChannel(ctx, spaceID, channelID, title, kind)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.spaces[spaceID]; !ok {
		return domain.Channel{}, ErrNotFound
	}
	if existing, ok := s.channels[channelID]; ok {
		return existing, nil
	}
	if kind == "" {
		kind = "text"
	}
	channel := domain.Channel{ID: channelID, SpaceID: spaceID, Title: title, Kind: kind, CreatedAt: s.clock.Now()}
	s.channels[channelID] = channel
	return channel, nil
}

func (s *Service) CreateSession(ctx context.Context, channelID string, participant domain.Participant) (domain.Channel, error) {
	if s.store != nil {
		return s.store.CreateSession(ctx, channelID, participant)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	channel, ok := s.channels[channelID]
	if !ok {
		return domain.Channel{}, ErrNotFound
	}
	s.participants[participant.ID] = participant
	return channel, nil
}

func (s *Service) Snapshot(ctx context.Context, claims ChatTokenClaims) (domain.Snapshot, error) {
	if s.store != nil {
		return s.store.Snapshot(ctx, claims)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	participant := domain.Participant{ID: claims.ParticipantID, DisplayName: claims.DisplayName, Role: domain.ParticipantRole(claims.Role)}
	channels := make([]domain.Channel, 0, len(claims.ChannelIDs))
	messages := make([]domain.Message, 0)
	readCursors := make([]domain.ReadCursor, 0)
	unread := map[string]int{}
	for _, channelID := range claims.ChannelIDs {
		channel, ok := s.channels[channelID]
		if !ok {
			continue
		}
		channels = append(channels, channel)
		cursor := s.readCursors[readCursorKey(channelID, claims.ParticipantID)]
		if cursor.ChannelID != "" {
			readCursors = append(readCursors, cursor)
		}
		for _, messageID := range s.messageIDsByChannel[channelID] {
			message := s.messages[messageID]
			messages = append(messages, message)
			if message.DeletedAt == nil && message.Author.ID != claims.ParticipantID && cursor.LastReadMessageID != message.ID {
				unread[channelID]++
			}
			if cursor.LastReadMessageID == message.ID {
				unread[channelID] = 0
			}
		}
	}
	sort.Slice(messages, func(i, j int) bool { return messages[i].CreatedAt.Before(messages[j].CreatedAt) })
	return domain.Snapshot{SpaceID: claims.SpaceID, Participant: participant, Channels: channels, Messages: messages, ReadCursors: readCursors, UnreadByChannel: unread}, nil
}

func (s *Service) ListMessages(ctx context.Context, claims ChatTokenClaims, channelID string, limit int, cursors ...string) ([]domain.Message, error) {
	before, after := "", ""
	if len(cursors) > 0 {
		before = cursors[0]
	}
	if len(cursors) > 1 {
		after = cursors[1]
	}
	if s.store != nil {
		return s.store.ListMessages(ctx, claims, channelID, limit, before, after)
	}
	if !allowedChannel(claims, channelID) {
		return nil, ErrForbidden
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	ids := s.messageIDsByChannel[channelID]
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	start := len(ids) - limit
	if start < 0 {
		start = 0
	}
	result := make([]domain.Message, 0, len(ids[start:]))
	for _, id := range ids[start:] {
		result = append(result, s.messages[id])
	}
	return result, nil
}

func (s *Service) SendMessage(ctx context.Context, claims ChatTokenClaims, channelID, markdown, replyToID string, attachments []domain.Attachment, idempotencyKeys ...string) (domain.Message, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store != nil {
		message, err := s.store.SendMessage(ctx, claims, channelID, markdown, replyToID, attachments, idempotencyKey)
		if err == nil {
			s.publish(Event{Type: "chat.message.created", SpaceID: claims.SpaceID, ChannelID: channelID, Payload: message})
			for _, preview := range message.LinkPreviews {
				s.publish(Event{Type: "chat.link.detected", SpaceID: claims.SpaceID, ChannelID: channelID, Payload: map[string]any{"messageId": message.ID, "url": preview.URL}})
			}
		}
		return message, err
	}
	if !allowedChannel(claims, channelID) {
		return domain.Message{}, ErrForbidden
	}
	body := strings.TrimSpace(markdown)
	if body == "" && len(attachments) == 0 {
		return domain.Message{}, ErrInvalidBody
	}
	for _, attachment := range attachments {
		if attachment.SizeBytes > MaxAttachmentSizeBytes {
			return domain.Message{}, ErrFileTooLarge
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	channel, ok := s.channels[channelID]
	if !ok {
		return domain.Message{}, ErrNotFound
	}
	message := domain.Message{
		ID:           "msg_" + uuid.NewString(),
		ChannelID:    channelID,
		Author:       domain.Participant{ID: claims.ParticipantID, DisplayName: claims.DisplayName, Role: domain.ParticipantRole(claims.Role)},
		BodyMarkdown: body,
		BodyPlain:    plainText(body),
		Mentions:     extractMentions(body),
		ReplyToID:    replyToID,
		Attachments:  attachments,
		LinkPreviews: extractLinkPreviews(body),
		Reactions:    map[string][]string{},
		CreatedAt:    s.clock.Now(),
	}
	s.messages[message.ID] = message
	s.messageIDsByChannel[channelID] = append(s.messageIDsByChannel[channelID], message.ID)
	s.publish(Event{Type: "chat.message.created", SpaceID: channel.SpaceID, ChannelID: channelID, Payload: message})
	return message, nil
}

func (s *Service) EditMessage(ctx context.Context, claims ChatTokenClaims, messageID, markdown string, idempotencyKeys ...string) (domain.Message, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store != nil {
		message, err := s.store.EditMessage(ctx, claims, messageID, markdown, idempotencyKey)
		if err == nil {
			s.publish(Event{Type: "chat.message.edited", SpaceID: claims.SpaceID, ChannelID: message.ChannelID, Payload: message})
			for _, preview := range message.LinkPreviews {
				s.publish(Event{Type: "chat.link.detected", SpaceID: claims.SpaceID, ChannelID: message.ChannelID, Payload: map[string]any{"messageId": message.ID, "url": preview.URL}})
			}
		}
		return message, err
	}
	body := strings.TrimSpace(markdown)
	if body == "" {
		return domain.Message{}, ErrInvalidBody
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	message, ok := s.messages[messageID]
	if !ok {
		return domain.Message{}, ErrNotFound
	}
	if message.Author.ID != claims.ParticipantID {
		return domain.Message{}, ErrForbidden
	}
	now := s.clock.Now()
	message.BodyMarkdown = body
	message.BodyPlain = plainText(body)
	message.Mentions = extractMentions(body)
	message.LinkPreviews = extractLinkPreviews(body)
	message.EditedAt = &now
	s.messages[messageID] = message
	channel := s.channels[message.ChannelID]
	s.publish(Event{Type: "chat.message.edited", SpaceID: channel.SpaceID, ChannelID: message.ChannelID, Payload: message})
	return message, nil
}

func (s *Service) DeleteMessage(ctx context.Context, claims ChatTokenClaims, messageID string, idempotencyKeys ...string) (domain.Message, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store != nil {
		message, err := s.store.DeleteMessage(ctx, claims, messageID, idempotencyKey)
		if err == nil {
			s.publish(Event{Type: "chat.message.deleted", SpaceID: claims.SpaceID, ChannelID: message.ChannelID, Payload: message})
		}
		return message, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	message, ok := s.messages[messageID]
	if !ok {
		return domain.Message{}, ErrNotFound
	}
	if message.Author.ID != claims.ParticipantID {
		return domain.Message{}, ErrForbidden
	}
	now := s.clock.Now()
	message.DeletedAt = &now
	message.BodyMarkdown = ""
	message.BodyPlain = ""
	message.Reactions = map[string][]string{}
	s.messages[messageID] = message
	channel := s.channels[message.ChannelID]
	s.publish(Event{Type: "chat.message.deleted", SpaceID: channel.SpaceID, ChannelID: message.ChannelID, Payload: message})
	return message, nil
}

func (s *Service) ToggleReaction(ctx context.Context, claims ChatTokenClaims, messageID, emoji string, idempotencyKeys ...string) (domain.Message, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store != nil {
		message, err := s.store.ToggleReaction(ctx, claims, messageID, emoji, idempotencyKey)
		if err == nil {
			s.publish(Event{Type: "chat.reaction.updated", SpaceID: claims.SpaceID, ChannelID: message.ChannelID, Payload: message})
		}
		return message, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	message, ok := s.messages[messageID]
	if !ok {
		return domain.Message{}, ErrNotFound
	}
	if message.Reactions == nil {
		message.Reactions = map[string][]string{}
	}
	users := message.Reactions[emoji]
	found := false
	next := users[:0]
	for _, userID := range users {
		if userID == claims.ParticipantID {
			found = true
			continue
		}
		next = append(next, userID)
	}
	if !found {
		next = append(next, claims.ParticipantID)
	}
	if len(next) == 0 {
		delete(message.Reactions, emoji)
	} else {
		message.Reactions[emoji] = next
	}
	s.messages[messageID] = message
	channel := s.channels[message.ChannelID]
	s.publish(Event{Type: "chat.reaction.updated", SpaceID: channel.SpaceID, ChannelID: message.ChannelID, Payload: message})
	return message, nil
}

func (s *Service) MarkRead(ctx context.Context, claims ChatTokenClaims, channelID, messageID string, idempotencyKeys ...string) (domain.ReadCursor, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store != nil {
		cursor, err := s.store.MarkRead(ctx, claims, channelID, messageID, idempotencyKey)
		if err == nil {
			s.publish(Event{Type: "chat.read.updated", SpaceID: claims.SpaceID, ChannelID: channelID, Payload: cursor})
		}
		return cursor, err
	}
	if !allowedChannel(claims, channelID) {
		return domain.ReadCursor{}, ErrForbidden
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cursor := domain.ReadCursor{ChannelID: channelID, ParticipantID: claims.ParticipantID, LastReadMessageID: messageID, UpdatedAt: s.clock.Now()}
	s.readCursors[readCursorKey(channelID, claims.ParticipantID)] = cursor
	channel := s.channels[channelID]
	s.publish(Event{Type: "chat.read.updated", SpaceID: channel.SpaceID, ChannelID: channelID, Payload: cursor})
	return cursor, nil
}

func (s *Service) CreateAttachmentUpload(ctx context.Context, claims ChatTokenClaims, fileName, contentType string, sizeBytes int64, idempotencyKeys ...string) (domain.Attachment, string, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if sizeBytes > MaxAttachmentSizeBytes {
		return domain.Attachment{}, "", ErrFileTooLarge
	}
	id := "att_" + uuid.NewString()
	objectKey := claims.SpaceID + "/" + claims.ParticipantID + "/" + id + "/" + sanitizeFileName(fileName)
	kind := "file"
	if strings.HasPrefix(contentType, "image/") {
		kind = "image"
	} else if strings.HasPrefix(contentType, "video/") {
		kind = "video"
	}
	url := "/chat-uploads/" + id + "/" + fileName
	uploadURL := url
	if s.objectStorage != nil {
		var err error
		uploadURL, err = s.objectStorage.CreateUploadURL(ctx, objectKey, contentType, sizeBytes)
		if err != nil {
			return domain.Attachment{}, "", err
		}
		url = s.objectStorage.PublicURL(objectKey)
	}
	if s.store != nil {
		attachment, err := s.store.CreateAttachmentUpload(ctx, claims, fileName, contentType, sizeBytes, id, objectKey, url, idempotencyKey)
		if err != nil {
			return domain.Attachment{}, "", err
		}
		attachment.ObjectKey = objectKey
		attachment.URL = url
		return attachment, uploadURL, nil
	}
	// V1 keeps storage pluggable. The local fallback upload URL is intentionally explicit;
	// production config points this contract at S3/MinIO presigned URLs.
	attachment := domain.Attachment{ID: id, FileName: fileName, ContentType: contentType, SizeBytes: sizeBytes, URL: url, Kind: kind, Status: "uploading", ObjectKey: objectKey}
	return attachment, uploadURL, nil
}

func (s *Service) CompleteAttachment(ctx context.Context, claims ChatTokenClaims, attachmentID string, idempotencyKeys ...string) (domain.Attachment, error) {
	idempotencyKey := ""
	if len(idempotencyKeys) > 0 {
		idempotencyKey = idempotencyKeys[0]
	}
	if s.store == nil {
		return domain.Attachment{ID: attachmentID, Status: "uploaded"}, nil
	}
	attachment, err := s.store.CompleteAttachment(ctx, claims, attachmentID, idempotencyKey)
	if err == nil {
		s.publish(Event{Type: "chat.attachment.uploaded", SpaceID: claims.SpaceID, Payload: attachment})
	}
	return attachment, err
}

func (s *Service) GetAttachment(ctx context.Context, claims ChatTokenClaims, attachmentID string) (domain.Attachment, error) {
	if s.store == nil {
		return domain.Attachment{}, ErrNotFound
	}
	return s.store.GetAttachment(ctx, claims, attachmentID)
}

func allowedChannel(claims ChatTokenClaims, channelID string) bool {
	for _, id := range claims.ChannelIDs {
		if id == channelID {
			return true
		}
	}
	return false
}

func readCursorKey(channelID, participantID string) string {
	return channelID + ":" + participantID
}

func (s *Service) publish(event Event) {
	if s.events != nil {
		s.events.Publish(event)
	}
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
