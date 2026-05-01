package application

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type ChatBootstrap struct {
	ChatURL       string `json:"chatUrl"`
	ChatToken     string `json:"chatToken"`
	ChatSpaceID   string `json:"chatSpaceId"`
	ChatChannelID string `json:"chatChannelId"`
	ParticipantID string `json:"participantId,omitempty"`
}

type ChatAdminClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewChatAdminClient(baseURL, apiKey string) *ChatAdminClient {
	return &ChatAdminClient{baseURL: strings.TrimRight(baseURL, "/"), apiKey: apiKey, client: http.DefaultClient}
}

func (c *ChatAdminClient) CreateSpace(ctx context.Context, spaceID, title string) error {
	var response struct {
		SpaceID string `json:"spaceId"`
	}
	return c.do(ctx, http.MethodPost, "/admin/v1/spaces", map[string]string{"spaceId": spaceID, "title": title}, &response)
}

func (c *ChatAdminClient) CreateChannel(ctx context.Context, spaceID, channelID, title string) error {
	var response struct {
		ChannelID string `json:"channelId"`
	}
	return c.do(ctx, http.MethodPost, "/admin/v1/spaces/"+spaceID+"/channels", map[string]string{"channelId": channelID, "title": title, "kind": "conference"}, &response)
}

func (c *ChatAdminClient) CreateSession(ctx context.Context, channelID string, participantID string, prefs PrejoinPreferences) (ChatBootstrap, error) {
	var result ChatBootstrap
	if err := c.do(ctx, http.MethodPost, "/admin/v1/channels/"+channelID+"/sessions", map[string]string{
		"participantId": participantID,
		"displayName":   prefs.DisplayName,
		"role":          string(prefs.Role),
	}, &result); err != nil {
		return ChatBootstrap{}, err
	}
	result.ParticipantID = participantID
	return result, nil
}

func (c *ChatAdminClient) do(ctx context.Context, method, path string, body any, out any) error {
	var payload *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		payload = bytes.NewReader(data)
	} else {
		payload = bytes.NewReader(nil)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, payload)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Chat-Admin-Key", c.apiKey)
	response, err := c.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("chat admin request failed: %s", response.Status)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(out)
}
