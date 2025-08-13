import AdminNotificationService from './AdminNotificationService';
import EmailAutomationService from '../config/emailService';

interface SupportTicket {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subject: string;
  description: string;
  category: 'order' | 'product' | 'payment' | 'refund' | 'technical' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  orderId?: string;
  tags: string[];
  messages: SupportMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

interface SupportMessage {
  id: string;
  sender: 'customer' | 'admin';
  senderName: string;
  senderEmail: string;
  message: string;
  attachments?: string[];
  isInternal: boolean;
  timestamp: Date;
}

class SupportTicketService {
  private tickets: Map<string, SupportTicket> = new Map();

  // ✅ CREATE SUPPORT TICKET
  async createTicket(ticketData: {
    customerId?: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    subject: string;
    description: string;
    category: SupportTicket['category'];
    orderId?: string;
    priority?: SupportTicket['priority'];
  }): Promise<SupportTicket> {
    
    const ticket: SupportTicket = {
      id: `TKT${Date.now()}`,
      customerId: ticketData.customerId,
      customerName: ticketData.customerName,
      customerEmail: ticketData.customerEmail,
      customerPhone: ticketData.customerPhone,
      subject: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category,
      priority: this.calculatePriority(ticketData.category, ticketData.description),
      status: 'open',
      orderId: ticketData.orderId,
      tags: this.generateTags(ticketData.category, ticketData.description),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add initial message
    const initialMessage: SupportMessage = {
      id: `MSG${Date.now()}`,
      sender: 'customer',
      senderName: ticketData.customerName,
      senderEmail: ticketData.customerEmail,
      message: ticketData.description,
      isInternal: false,
      timestamp: new Date()
    };
    ticket.messages.push(initialMessage);

    this.tickets.set(ticket.id, ticket);

    // Send confirmation email to customer
    await this.sendTicketCreatedConfirmation(ticket);

    // Notify admins
    await AdminNotificationService.notifySystemAlert(
      '🎫 New Support Ticket',
      `${ticket.category.toUpperCase()} ticket from ${ticket.customerName}: ${ticket.subject}`,
      {
        ticketId: ticket.id,
        category: ticket.category,
        priority: ticket.priority,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        orderId: ticket.orderId
      }
    );

    console.log('✅ Support ticket created:', ticket.id);
    return ticket;
  }

  // ✅ ADD MESSAGE TO TICKET
  async addMessage(
    ticketId: string,
    sender: 'customer' | 'admin',
    senderName: string,
    senderEmail: string,
    message: string,
    isInternal: boolean = false,
    attachments?: string[]
  ): Promise<SupportMessage> {
    
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const newMessage: SupportMessage = {
      id: `MSG${Date.now()}`,
      sender,
      senderName,
      senderEmail,
      message,
      attachments,
      isInternal,
      timestamp: new Date()
    };

    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date();

    // Update ticket status if needed
    if (sender === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    // Send email notification
    if (!isInternal) {
      if (sender === 'admin') {
        await this.sendAdminResponseNotification(ticket, newMessage);
      } else {
        await this.sendCustomerMessageNotification(ticket, newMessage);
      }
    }

    console.log('✅ Message added to ticket:', ticketId);
    return newMessage;
  }

  // ✅ UPDATE TICKET STATUS
  async updateTicketStatus(
    ticketId: string, 
    status: SupportTicket['status'], 
    adminName: string,
    resolution?: string
  ): Promise<SupportTicket> {
    
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const previousStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date();

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
    }

    // Add internal message about status change
    if (resolution) {
      const statusMessage: SupportMessage = {
        id: `MSG${Date.now()}`,
        sender: 'admin',
        senderName: adminName,
        senderEmail: 'support@nakodamobile.com',
        message: `Ticket status updated to: ${status}${resolution ? `\n\nResolution: ${resolution}` : ''}`,
        isInternal: false,
        timestamp: new Date()
      };
      ticket.messages.push(statusMessage);
    }

    // Send status update email to customer
    await this.sendStatusUpdateNotification(ticket, previousStatus, resolution);

    console.log('✅ Ticket status updated:', ticketId, previousStatus, '→', status);
    return ticket;
  }

  // ✅ ASSIGN TICKET
  async assignTicket(ticketId: string, adminEmail: string, adminName: string): Promise<SupportTicket> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.assignedTo = adminEmail;
    ticket.status = 'in_progress';
    ticket.updatedAt = new Date();

    // Add internal message
    const assignmentMessage: SupportMessage = {
      id: `MSG${Date.now()}`,
      sender: 'admin',
      senderName: 'System',
      senderEmail: 'system@nakodamobile.com',
      message: `Ticket assigned to ${adminName} (${adminEmail})`,
      isInternal: true,
      timestamp: new Date()
    };
    ticket.messages.push(assignmentMessage);

    console.log('✅ Ticket assigned:', ticketId, 'to', adminName);
    return ticket;
  }

  // ✅ GET TICKETS
  getTickets(filters?: {
    status?: SupportTicket['status'];
    category?: SupportTicket['category'];
    priority?: SupportTicket['priority'];
    assignedTo?: string;
    customerId?: string;
  }): SupportTicket[] {
    
    let tickets = Array.from(this.tickets.values());

    if (filters) {
      if (filters.status) tickets = tickets.filter(t => t.status === filters.status);
      if (filters.category) tickets = tickets.filter(t => t.category === filters.category);
      if (filters.priority) tickets = tickets.filter(t => t.priority === filters.priority);
      if (filters.assignedTo) tickets = tickets.filter(t => t.assignedTo === filters.assignedTo);
      if (filters.customerId) tickets = tickets.filter(t => t.customerId === filters.customerId);
    }

    return tickets.sort((a, b) => {
      // Sort by priority first, then by date
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  // ✅ GET TICKET BY ID
  getTicket(ticketId: string): SupportTicket | null {
    return this.tickets.get(ticketId) || null;
  }

  // ✅ SEARCH TICKETS
  searchTickets(query: string): SupportTicket[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.tickets.values()).filter(ticket => 
      ticket.id.toLowerCase().includes(searchTerm) ||
      ticket.subject.toLowerCase().includes(searchTerm) ||
      ticket.description.toLowerCase().includes(searchTerm) ||
      ticket.customerName.toLowerCase().includes(searchTerm) ||
      ticket.customerEmail.toLowerCase().includes(searchTerm) ||
      ticket.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // ✅ GET TICKET STATISTICS
  getTicketStats() {
    const tickets = Array.from(this.tickets.values());
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      highPriority: tickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      last30Days: tickets.filter(t => t.createdAt > last30Days).length,
      averageResolutionTime: this.calculateAverageResolutionTime(),
      byCategory: {
        order: tickets.filter(t => t.category === 'order').length,
        product: tickets.filter(t => t.category === 'product').length,
        payment: tickets.filter(t => t.category === 'payment').length,
        refund: tickets.filter(t => t.category === 'refund').length,
        technical: tickets.filter(t => t.category === 'technical').length,
        general: tickets.filter(t => t.category === 'general').length,
      }
    };
  }

  // ✅ HELPER METHODS
  private calculatePriority(category: string, description: string): SupportTicket['priority'] {
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
    const highKeywords = ['refund', 'payment failed', 'order not received', 'damaged'];
    
    const descLower = description.toLowerCase();
    
    if (urgentKeywords.some(keyword => descLower.includes(keyword))) {
      return 'urgent';
    }
    
    if (category === 'payment' || category === 'refund' || 
        highKeywords.some(keyword => descLower.includes(keyword))) {
      return 'high';
    }
    
    if (category === 'order' || category === 'product') {
      return 'medium';
    }
    
    return 'low';
  }

  private generateTags(category: string, description: string): string[] {
    const tags = [category];
    const descLower = description.toLowerCase();
    
    if (descLower.includes('refund')) tags.push('refund');
    if (descLower.includes('payment')) tags.push('payment');
    if (descLower.includes('delivery')) tags.push('delivery');
    if (descLower.includes('damaged')) tags.push('damaged');
    if (descLower.includes('defective')) tags.push('defective');
    if (descLower.includes('wrong item')) tags.push('wrong-item');
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private calculateAverageResolutionTime(): number {
    const resolvedTickets = Array.from(this.tickets.values())
      .filter(t => t.resolvedAt);
    
    if (resolvedTickets.length === 0) return 0;
    
    const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
      const resolutionTime = ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime;
    }, 0);
    
    return Math.round(totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60)); // Hours
  }

  // ✅ EMAIL NOTIFICATIONS
  private async sendTicketCreatedConfirmation(ticket: SupportTicket) {
    // TODO: Implement ticket creation confirmation email
    console.log('📧 Ticket creation confirmation sent:', ticket.id);
  }

  private async sendAdminResponseNotification(ticket: SupportTicket, message: SupportMessage) {
    // TODO: Implement admin response notification email
    console.log('📧 Admin response notification sent:', ticket.id);
  }

  private async sendCustomerMessageNotification(ticket: SupportTicket, message: SupportMessage) {
    // TODO: Implement customer message notification email to admin
    console.log('📧 Customer message notification sent:', ticket.id);
  }

  private async sendStatusUpdateNotification(ticket: SupportTicket, previousStatus: string, resolution?: string) {
    // TODO: Implement status update notification email
    console.log('📧 Status update notification sent:', ticket.id);
  }
}

export default new SupportTicketService();
