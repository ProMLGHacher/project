package application

type VideoQuality string

const (
	VideoQualityLow    VideoQuality = "low"
	VideoQualityMedium VideoQuality = "medium"
	VideoQualityHigh   VideoQuality = "high"
)

type SubscriptionDecisionInput struct {
	IsScreenShare   bool
	IsPinned        bool
	IsActiveSpeaker bool
	TileAreaRatio   float64
}

type SubscriptionService struct{}

func NewSubscriptionService() *SubscriptionService {
	return &SubscriptionService{}
}

func (s *SubscriptionService) SelectVideoQuality(input SubscriptionDecisionInput) VideoQuality {
	switch {
	case input.IsScreenShare || input.IsPinned:
		return VideoQualityHigh
	case input.IsActiveSpeaker || input.TileAreaRatio >= 0.2:
		return VideoQualityMedium
	default:
		return VideoQualityLow
	}
}
