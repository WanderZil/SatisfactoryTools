import {IController} from 'angular';
import axios from 'axios';

export class HomeController implements IController
{

	public showFeedbackForm: boolean = false;
	public feedbackData: {
		name: string;
		email: string;
		subject: string;
		message: string;
	} = {
		name: '',
		email: '',
		subject: '',
		message: '',
	};
	public feedbackSuccess: boolean = false;
	public feedbackError: string = '';
	public feedbackSubmitting: boolean = false;

	public closeFeedbackForm(): void
	{
		this.showFeedbackForm = false;
		this.feedbackSuccess = false;
		this.feedbackError = '';
		this.feedbackData = {
			name: '',
			email: '',
			subject: '',
			message: '',
		};
	}

	public submitFeedback(): void
	{
		if (!this.feedbackData.name || !this.feedbackData.email || !this.feedbackData.subject || !this.feedbackData.message) {
			this.feedbackError = 'Please fill in all required fields.';
			return;
		}

		this.feedbackSubmitting = true;
		this.feedbackError = '';
		this.feedbackSuccess = false;

		axios.post('/api/feedback', this.feedbackData)
			.then(() => {
				this.feedbackSuccess = true;
				this.feedbackSubmitting = false;
				// Auto close after 3 seconds
				setTimeout(() => {
					this.closeFeedbackForm();
				}, 3000);
			})
			.catch((error) => {
				this.feedbackSubmitting = false;
				if (error.response && error.response.data && error.response.data.error) {
					this.feedbackError = error.response.data.error;
				} else {
					this.feedbackError = 'Failed to send feedback. Please try again later.';
				}
			});
	}

}
